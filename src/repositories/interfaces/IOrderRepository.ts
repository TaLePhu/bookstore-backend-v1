import { Order, OrderStatus } from '@entities/Order';

export interface AdminOrderListItem {
  id: string;
  orderCode: string | null;
  customerName: string | null;
  customerUserName: string | null;
  customerEmail: string | null;
  createdAt: Date;
  totalItems: number;
  totalAmount: number;
  status: OrderStatus;
  cancelRequested?: boolean;
}

export interface CustomerOrderHistoryItem {
  id: string;
  orderCode: string | null;
  createdAt: Date;
  totalAmount: number;
  status: OrderStatus;
}

export interface IOrderRepository {
  /**
   * Tìm danh sách đơn hàng của user với phân trang.
   */
  findByUserId(
    userId: string,
    page: number,
    limit: number
  ): Promise<{ orders: Order[]; total: number }>;

  /**
   * Tìm đơn hàng theo id VÀ userId — đảm bảo phân quyền.
   * Trả về null nếu không tìm thấy hoặc không thuộc về user.
   */
  findByIdAndUserId(orderId: string, userId: string): Promise<Order | null>;

  /**
   * Danh sach don hang cho admin/staff (co loc, phan trang).
   */
  findAllForManagement(params: {
    page: number;
    limit: number;
    status?: OrderStatus;
  }): Promise<{ orders: AdminOrderListItem[]; total: number }>;

  /**
   * Tim chi tiet don hang theo id (admin/staff).
   */
  findById(orderId: string): Promise<Order | null>;

  /**
   * Tim chi tiet don hang theo ma don (admin/staff).
   */
  findByOrderCode(orderCode: string): Promise<Order | null>;

  /**
   * Dem so don theo trang thai.
   */
  countByStatus(status: OrderStatus): Promise<number>;

  /**
   * Dem so don nhan vien da chuyen sang SHIPPED trong khoang thoi gian.
   */
  countStaffPackedInRange(staffId: string, start: Date, end: Date): Promise<number>;

  /**
   * Lich su mua hang theo email/phone (chi tra ve list).
   */
  findCustomerHistory(params: {
    email?: string;
    phone?: string;
  }): Promise<CustomerOrderHistoryItem[]>;
}
