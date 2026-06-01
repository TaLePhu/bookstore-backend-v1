import { Router } from 'express';
import { container } from 'tsyringe';
import { PaymentController } from '@controllers/PaymentController';

const router = Router();
const paymentController = container.resolve(PaymentController);

router.post('/momo/ipn', paymentController.momoIpn);
router.post('/momo/demo-complete', paymentController.completeMomoDemoPayment);
router.get('/momo/status', paymentController.getMomoPaymentByOrder);

export default router;
