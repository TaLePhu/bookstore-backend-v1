import { singleton } from 'tsyringe';
import { AppDataSource } from '@config/data-source';
import { Book } from '@entities/Book';
import { Category } from '@entities/Category';
import { Order, OrderStatus } from '@entities/Order';
import { OrderItem } from '@entities/OrderItem';
import { Role, User } from '@entities/User';

export interface AdminDashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  totalBooks: number;
}

export interface AdminDashboardChartItem {
  month: string;
  revenue: number;
  orders: number;
}

export interface AdminCategoryDistributionItem {
  name: string;
  value: number;
  count: number;
}

export interface AdminRecentOrderItem {
  id: string;
  orderCode: string | null;
  customerName: string;
  totalAmount: number;
  status: OrderStatus;
  createdAt: Date;
}

export interface AdminDashboardResponse {
  stats: AdminDashboardStats;
  revenueData: AdminDashboardChartItem[];
  categoryData: AdminCategoryDistributionItem[];
  recentOrders: AdminRecentOrderItem[];
}

@singleton()
export class AdminDashboardService {
  async getDashboard(): Promise<AdminDashboardResponse> {
    const orderRepo = AppDataSource.getRepository(Order);
    const bookRepo = AppDataSource.getRepository(Book);
    const userRepo = AppDataSource.getRepository(User);

    const [revenueRow, totalOrders, totalCustomers, totalBooks, revenueData, categoryData, recentOrders] =
      await Promise.all([
        orderRepo
          .createQueryBuilder('order_entity')
          .select('COALESCE(SUM(order_entity.totalAmount), 0)', 'totalRevenue')
          .where('order_entity.status = :status', { status: OrderStatus.COMPLETED })
          .getRawOne<{ totalRevenue: string }>(),
        orderRepo.count(),
        userRepo.count({ where: { role: Role.CUSTOMER } }),
        bookRepo.count(),
        this.getRevenueData(),
        this.getCategoryData(),
        this.getRecentOrders(),
      ]);

    return {
      stats: {
        totalRevenue: Number(revenueRow?.totalRevenue ?? 0),
        totalOrders,
        totalCustomers,
        totalBooks,
      },
      revenueData,
      categoryData,
      recentOrders,
    };
  }

  private async getRevenueData(): Promise<AdminDashboardChartItem[]> {
    const orderRepo = AppDataSource.getRepository(Order);
    const now = new Date();
    const months = Array.from({ length: 8 }).map((_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (7 - index), 1);
      const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      return { date, next, label: `T${date.getMonth() + 1}` };
    });

    const start = months[0].date;
    const rows = await orderRepo
      .createQueryBuilder('order_entity')
      .leftJoin(
        (subQuery) =>
          subQuery
            .select('status_log.order_id', 'order_id')
            .addSelect('MIN(status_log.created_at)', 'completed_at')
            .from('order_status_logs', 'status_log')
            .where('status_log.to_status = :completed')
            .groupBy('status_log.order_id'),
        'completion_log',
        'completion_log.order_id = order_entity.id'
      )
      .select(`DATE_TRUNC('month', COALESCE(completion_log.completed_at, order_entity.updated_at))`, 'month')
      .addSelect('COUNT(order_entity.id)', 'orders')
      .addSelect('COALESCE(SUM(order_entity.total_amount), 0)', 'revenue')
      .where('order_entity.status = :completed', { completed: OrderStatus.COMPLETED })
      .andWhere('COALESCE(completion_log.completed_at, order_entity.updated_at) >= :start', { start })
      .setParameter('completed', OrderStatus.COMPLETED)
      .groupBy(`DATE_TRUNC('month', COALESCE(completion_log.completed_at, order_entity.updated_at))`)
      .orderBy(`DATE_TRUNC('month', COALESCE(completion_log.completed_at, order_entity.updated_at))`, 'ASC')
      .getRawMany<{ month: Date; orders: string; revenue: string }>();

    return months.map((month) => {
      const row = rows.find((item) => {
        const date = new Date(item.month);
        return date >= month.date && date < month.next;
      });

      return {
        month: month.label,
        orders: Number(row?.orders ?? 0),
        revenue: Number(row?.revenue ?? 0),
      };
    });
  }

  private async getCategoryData(): Promise<AdminCategoryDistributionItem[]> {
    const categoryRepo = AppDataSource.getRepository(Category);
    const rows = await categoryRepo
      .createQueryBuilder('category')
      .leftJoin('category.books', 'book')
      .select('category.name', 'name')
      .addSelect('COUNT(book.id)', 'count')
      .groupBy('category.id')
      .addGroupBy('category.name')
      .orderBy('COUNT(book.id)', 'DESC')
      .getRawMany<{ name: string; count: string }>();

    const total = rows.reduce((sum, row) => sum + Number(row.count ?? 0), 0);
    return rows.map((row) => {
      const count = Number(row.count ?? 0);
      return {
        name: row.name,
        count,
        value: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    });
  }

  private async getRecentOrders(): Promise<AdminRecentOrderItem[]> {
    const orderRepo = AppDataSource.getRepository(Order);
    const rows = await orderRepo
      .createQueryBuilder('order_entity')
      .leftJoin('order_entity.user', 'user')
      .select('order_entity.id', 'id')
      .addSelect('order_entity.orderCode', 'orderCode')
      .addSelect('order_entity.totalAmount', 'totalAmount')
      .addSelect('order_entity.status', 'status')
      .addSelect('order_entity.createdAt', 'createdAt')
      .addSelect('user.fullName', 'fullName')
      .addSelect('user.userName', 'userName')
      .addSelect('user.email', 'email')
      .orderBy('order_entity.createdAt', 'DESC')
      .limit(5)
      .getRawMany<{
        id: string;
        orderCode: string | null;
        totalAmount: string;
        status: OrderStatus;
        createdAt: Date;
        fullName: string | null;
        userName: string | null;
        email: string | null;
      }>();

    return rows.map((row) => ({
      id: row.id,
      orderCode: row.orderCode,
      customerName: row.fullName || row.userName || row.email || 'Khách hàng',
      totalAmount: Number(row.totalAmount ?? 0),
      status: row.status,
      createdAt: new Date(row.createdAt),
    }));
  }
}
