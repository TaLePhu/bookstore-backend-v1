import crypto from 'crypto';
import { AppDataSource } from '@config/data-source';
import { getEnv } from '@config/env';
import { Order, OrderStatus } from '@entities/Order';
import { Payment, PaymentMethod, PaymentStatus } from '@entities/Payment';
import { AppError, NotFoundError } from '@utils/errors';

type MomoCreateResponse = {
  partnerCode?: string;
  requestId?: string;
  orderId?: string;
  amount?: number;
  responseTime?: number;
  message?: string;
  resultCode?: number;
  payUrl?: string;
  deeplink?: string;
  qrCodeUrl?: string;
};

type MomoIpnPayload = {
  partnerCode?: string;
  orderId?: string;
  requestId?: string;
  amount?: number;
  orderInfo?: string;
  orderType?: string;
  transId?: number | string;
  resultCode?: number;
  message?: string;
  payType?: string;
  responseTime?: number;
  extraData?: string;
  signature?: string;
};

export class MomoPaymentService {
  private getConfig() {
    const env = getEnv();
    if (!env.momo.demoMode && (!env.momo.partnerCode || !env.momo.accessKey || !env.momo.secretKey)) {
      throw new AppError('MoMo payment is not configured', 500);
    }
    return env;
  }

  private sign(rawSignature: string, secretKey: string): string {
    return crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');
  }

  async createPayment(order: Order): Promise<MomoCreateResponse> {
    const env = this.getConfig();
    const payment = (order.payments || []).find((item) => item.method === PaymentMethod.MOMO);

    if (!payment) {
      throw new NotFoundError('MoMo payment record not found');
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      throw new AppError('Order is already paid', 400);
    }

    const amount = Math.round(Number(order.totalAmount || 0));
    if (amount < 1000 || amount > 50000000) {
      throw new AppError('MoMo amount must be between 1,000 and 50,000,000 VND', 400);
    }

    const orderId = `${order.orderCode || order.id}-${Date.now()}`.replace(/[^0-9a-zA-Z_.-]/g, '');
    const requestId = `${orderId}-REQ`;

    if (env.momo.demoMode) {
      return this.createDemoPayment(payment, order, orderId, requestId, amount);
    }

    const requestType = 'captureWallet';
    const extraData = Buffer.from(JSON.stringify({ orderId: order.id, orderCode: order.orderCode })).toString('base64');
    const redirectUrl = `${env.frontendUrl}/track-order?orderCode=${encodeURIComponent(order.orderCode || order.id)}`;
    const ipnUrl = `${env.apiPublicUrl}/api/v1/payments/momo/ipn`;
    const orderInfo = `Thanh toan don hang ${order.orderCode || order.id}`;
    const rawSignature = [
      `accessKey=${env.momo.accessKey}`,
      `amount=${amount}`,
      `extraData=${extraData}`,
      `ipnUrl=${ipnUrl}`,
      `orderId=${orderId}`,
      `orderInfo=${orderInfo}`,
      `partnerCode=${env.momo.partnerCode}`,
      `redirectUrl=${redirectUrl}`,
      `requestId=${requestId}`,
      `requestType=${requestType}`,
    ].join('&');

    const payload = {
      partnerCode: env.momo.partnerCode,
      requestType,
      ipnUrl,
      redirectUrl,
      orderId,
      amount,
      orderInfo,
      requestId,
      extraData,
      signature: this.sign(rawSignature, env.momo.secretKey),
      lang: 'vi',
    };

    const response = await fetch(env.momo.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as MomoCreateResponse;
    if (!response.ok || result.resultCode !== 0) {
      throw new AppError(result.message || 'Cannot create MoMo payment', 502);
    }

    await AppDataSource.getRepository(Payment).update(payment.id, {
      provider: 'MOMO',
      providerRequestId: requestId,
      providerOrderId: orderId,
      paymentUrl: result.payUrl || null,
      qrCodeUrl: result.qrCodeUrl || null,
      deeplink: result.deeplink || null,
      rawResponse: result as Record<string, unknown>,
    });

    return result;
  }

  private async createDemoPayment(
    payment: Payment,
    order: Order,
    orderId: string,
    requestId: string,
    amount: number
  ): Promise<MomoCreateResponse> {
    const env = getEnv();
    const orderCode = order.orderCode || order.id;
    const result: MomoCreateResponse = {
      partnerCode: 'MOMO_DEMO',
      requestId,
      orderId,
      amount,
      responseTime: Date.now(),
      message: 'Demo MoMo payment created.',
      resultCode: 0,
      payUrl: `${env.frontendUrl}/track-order?orderCode=${encodeURIComponent(orderCode)}`,
      deeplink: `momo-demo://pay?orderCode=${encodeURIComponent(orderCode)}&amount=${amount}`,
      qrCodeUrl: JSON.stringify({
        provider: 'MOMO_DEMO',
        orderCode,
        amount,
        note: 'Demo QR only. No real money is transferred.',
      }),
    };

    await AppDataSource.getRepository(Payment).update(payment.id, {
      provider: 'MOMO_DEMO',
      providerRequestId: requestId,
      providerOrderId: orderId,
      paymentUrl: result.payUrl || null,
      qrCodeUrl: result.qrCodeUrl || null,
      deeplink: result.deeplink || null,
      rawResponse: result as Record<string, unknown>,
    });

    return result;
  }

  verifyIpn(payload: MomoIpnPayload): boolean {
    const env = this.getConfig();
    const rawSignature = [
      `accessKey=${env.momo.accessKey}`,
      `amount=${payload.amount ?? ''}`,
      `extraData=${payload.extraData ?? ''}`,
      `message=${payload.message ?? ''}`,
      `orderId=${payload.orderId ?? ''}`,
      `orderInfo=${payload.orderInfo ?? ''}`,
      `orderType=${payload.orderType ?? ''}`,
      `partnerCode=${payload.partnerCode ?? ''}`,
      `payType=${payload.payType ?? ''}`,
      `requestId=${payload.requestId ?? ''}`,
      `responseTime=${payload.responseTime ?? ''}`,
      `resultCode=${payload.resultCode ?? ''}`,
      `transId=${payload.transId ?? ''}`,
    ].join('&');

    return this.sign(rawSignature, env.momo.secretKey) === payload.signature;
  }

  async handleIpn(payload: MomoIpnPayload): Promise<void> {
    if (!this.verifyIpn(payload)) {
      throw new AppError('Invalid MoMo signature', 400);
    }

    const payment = await AppDataSource.getRepository(Payment).findOne({
      where: {
        provider: 'MOMO',
        providerOrderId: payload.orderId,
      },
      relations: ['order'],
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    if (Math.round(Number(payment.amount || 0)) !== Number(payload.amount || 0)) {
      throw new AppError('MoMo amount does not match payment amount', 400);
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      return;
    }

    const isSuccess = payload.resultCode === 0;
    await AppDataSource.transaction(async (manager) => {
      await manager.update(Payment, payment.id, {
        status: isSuccess ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
        providerTransactionId: payload.transId ? String(payload.transId) : null,
        rawResponse: payload as Record<string, unknown>,
        paidAt: isSuccess ? new Date() : null,
      });

      if (isSuccess && payment.order?.status === OrderStatus.PENDING) {
        await manager.update(Order, payment.orderId, { status: OrderStatus.PROCESSING });
      }
    });
  }

  async getByOrderCode(orderCode: string): Promise<Payment | null> {
    return AppDataSource.getRepository(Payment)
      .createQueryBuilder('payment')
      .innerJoinAndSelect('payment.order', 'order')
      .where('order.orderCode = :orderCode', { orderCode })
      .andWhere('payment.method = :method', { method: PaymentMethod.MOMO })
      .getOne();
  }

  async completeDemoPayment(orderCode: string): Promise<Payment> {
    const payment = await this.getByOrderCode(orderCode);

    if (!payment) {
      throw new NotFoundError('Demo MoMo payment not found');
    }

    if (payment.provider !== 'MOMO_DEMO') {
      throw new AppError('This payment is not in MoMo demo mode', 400);
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      await AppDataSource.transaction(async (manager) => {
        await manager.update(Payment, payment.id, {
          status: PaymentStatus.COMPLETED,
          providerTransactionId: `DEMO-${Date.now()}`,
          paidAt: new Date(),
          rawResponse: {
            ...(payment.rawResponse || {}),
            demoCompletedAt: new Date().toISOString(),
          },
        });

        if (payment.order?.status === OrderStatus.PENDING) {
          await manager.update(Order, payment.orderId, { status: OrderStatus.PROCESSING });
        }
      });
    }

    const updated = await this.getByOrderCode(orderCode);
    return updated || payment;
  }
}
