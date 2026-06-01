import { Request, Response, NextFunction } from 'express';
import { injectable } from 'tsyringe';
import { MomoPaymentService } from '@services/MomoPaymentService';

@injectable()
export class PaymentController {
  private momoPaymentService = new MomoPaymentService();

  private toPaymentResponse(payment: Awaited<ReturnType<MomoPaymentService['getByOrderCode']>>) {
    return payment
      ? {
          id: payment.id,
          amount: payment.amount,
          method: payment.method,
          status: payment.status,
          paymentUrl: payment.paymentUrl,
          qrCodeUrl: payment.qrCodeUrl,
          deeplink: payment.deeplink,
          paidAt: payment.paidAt,
          orderCode: payment.order?.orderCode,
        }
      : null;
  }

  momoIpn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.momoPaymentService.handleIpn(req.body);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  getMomoPaymentByOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderCode = String(req.query.orderCode || '').trim();
      const payment = orderCode ? await this.momoPaymentService.getByOrderCode(orderCode) : null;

      res.status(200).json({
        success: true,
        data: this.toPaymentResponse(payment),
        message: 'Get MoMo payment successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  completeMomoDemoPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderCode = String(req.body?.orderCode || '').trim();
      const payment = await this.momoPaymentService.completeDemoPayment(orderCode);

      res.status(200).json({
        success: true,
        data: this.toPaymentResponse(payment),
        message: 'Complete MoMo demo payment successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
