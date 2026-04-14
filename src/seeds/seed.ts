import { AppDataSource } from '../config/data-source';
import { Category } from '../entities/Category';
import { Book } from '../entities/Book';
import { BookImage } from '../entities/BookImage';
import { User, Role } from '../entities/User';
import { UserAdvance } from '../entities/UserAdvance';
import { Address } from '../entities/Address';
import { Review } from '../entities/Review';
import { Cart } from '../entities/Cart';
import { CartItem } from '../entities/CartItem';
import { Order, OrderStatus } from '../entities/Order';
import { OrderItem } from '../entities/OrderItem';
import { Payment, PaymentMethod, PaymentStatus } from '../entities/Payment';
import { UserBehavior, BehaviorType } from '../entities/UserBehavior';
import * as bcrypt from 'bcryptjs';

type SeedOptions = {
  initializeDataSource?: boolean;
  destroyDataSource?: boolean;
  cleanupBeforeSeed?: boolean;
};

export async function runSeed(options: SeedOptions = {}) {
  const {
    initializeDataSource = true,
    destroyDataSource = true,
    cleanupBeforeSeed = true,
  } = options;

  if (initializeDataSource && !AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  console.log('🌱 Bắt đầu seed Database...');

  if (cleanupBeforeSeed) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    console.log('🗑️ Xóa dữ liệu rác cũ...');
    await queryRunner.query(`TRUNCATE TABLE categories CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE users CASCADE`);
    await queryRunner.release();
  }

  // 1. Tạo Users
  console.log('👤 Tạo Users...');
  const userRepo = AppDataSource.getRepository(User);
  const passwordHash = await bcrypt.hash('123456', 10);
  const users: User[] = [];
  for (let i = 1; i <= 5; i++) {
    const user = new User();
    user.userName = `user${i}`;
    user.fullName = `Người Dùng ${i}`;
    user.email = `user${i}@example.com`;
    user.passwordHash = passwordHash;
    user.role = i === 1 ? Role.ADMIN : Role.CUSTOMER;
    user.isVerified = true;

    const userAdvance = new UserAdvance();
    userAdvance.phone = `090123456${i}`;
    userAdvance.address = `123 Đường Số ${i}, TP. HCM`;
    userAdvance.gender = i % 2 === 0 ? 'Nữ' : 'Nam';
    user.userAdvance = userAdvance;

    users.push(await userRepo.save(user));
  }

  // 2. Tạo Address
  console.log('🏠 Tạo Address...');
  const addressRepo = AppDataSource.getRepository(Address);
  const addresses: Address[] = [];
  for (let i = 0; i < 5; i++) {
    const addr = new Address();
    addr.user = users[i];
    addr.receiverName = `Người nhận ${i + 1}`;
    addr.phone = `090123456${i}`;
    addr.addressLine = `${i + 1}/10 Nguyễn Trãi`;
    addr.city = 'Hồ Chí Minh';
    addresses.push(await addressRepo.save(addr));
  }

  // 3. Tạo Category
  console.log('📚 Tạo Categories...');
  const categoryRepo = AppDataSource.getRepository(Category);
  const categoryNames = ['Văn học', 'Kinh tế', 'Kỹ năng sống', 'Tiểu thuyết', 'Khoa học'];
  const categories: Category[] = [];
  for (let i = 0; i < 5; i++) {
    const cat = new Category();
    cat.name = categoryNames[i];
    cat.description = `Sách thuộc thể loại ${categoryNames[i]}`;
    categories.push(await categoryRepo.save(cat));
  }

  // 4. Tạo Book
  console.log('📖 Tạo Books...');
  const bookRepo = AppDataSource.getRepository(Book);
  const books: Book[] = [];
  for (let i = 1; i <= 10; i++) {
    const book = new Book();
    book.title = `Sách Tuyệt Đỉnh ${i}`;
    book.author = `Tác Giả ${i % 3 + 1}`;
    book.description = `Đây là nội dung tóm tắt cực hay của quyển sách số ${i}...`;
    book.price = (Math.floor(Math.random() * 10) + 5) * 10000;
    book.stock = 100;
    book.isbn = `978-00${i.toString().padStart(6, '0')}`;
    book.category = categories[i % 5];
    
    // New Book Details
    book.translator = `Người Dịch ${i}`;
    book.publisher = `Nhà Xuất Bản ${i % 2 === 0 ? 'Thanh Niên' : 'Kim Đồng'}`;
    book.publishYear = 2020 + (i % 5);
    book.pages = 150 + i * 20;
    book.dimensions = '13 x 20.5 cm';
    book.weight = `${200 + i * 15}g`;
    book.format = i % 2 === 0 ? 'Bìa cứng' : 'Bìa mềm';
    book.language = 'Tiếng Việt';
    book.originalPrice = Number(book.price) * 1.25; // 25% original price markup
    book.discount = 20; // 20% fake discount
    book.highlights = [
      'Điểm nhấn 1 của sách',
      'Được độc giả đánh giá rất cao',
      'Thuộc top bán chạy năm nay'
    ];

    books.push(await bookRepo.save(book));
  }

  // 5. Tạo BookImage
  console.log('🖼️ Tạo BookImages...');
  const bookImageRepo = AppDataSource.getRepository(BookImage);
  for (let i = 0; i < 10; i++) {
    const img1 = new BookImage();
    img1.book = books[i];
    // Main image
    img1.url = 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=800';
    img1.isPrimary = true;
    await bookImageRepo.save(img1);
  }

  // 6. Tạo Review
  console.log('⭐ Tạo Reviews...');
  const reviewRepo = AppDataSource.getRepository(Review);
  for (let i = 0; i < 5; i++) {
    const review = new Review();
    review.user = users[i];
    review.book = books[i % 5];
    review.rating = 4 + (i % 2);
    review.comment = 'Sách rất hay, đóng gói cẩn thận!';
    await reviewRepo.save(review);
  }

  // 7. Tạo Cart & CartItem
  console.log('🛒 Tạo Carts & CartItems...');
  const cartRepo = AppDataSource.getRepository(Cart);
  const cartItemRepo = AppDataSource.getRepository(CartItem);
  for (let i = 0; i < 5; i++) {
    const cart = new Cart();
    cart.user = users[i];
    const savedCart = await cartRepo.save(cart);

    const cItem = new CartItem();
    cItem.cart = savedCart;
    cItem.book = books[i % 5];
    cItem.quantity = i + 1;
    await cartItemRepo.save(cItem);
  }

  // 8. Tạo Order, OrderItem & Payment
  console.log('📦 Tạo Orders & Payments...');
  const orderRepo = AppDataSource.getRepository(Order);
  const orderItemRepo = AppDataSource.getRepository(OrderItem);
  const paymentRepo = AppDataSource.getRepository(Payment);

  for (let i = 0; i < 5; i++) {
    const order = new Order();
    order.user = users[i];
    order.totalAmount = books[i % 5].price * 2;
    order.status = OrderStatus.PENDING;
    order.address = addresses[i];
    const savedOrder = await orderRepo.save(order);

    const oItem = new OrderItem();
    oItem.order = savedOrder;
    oItem.book = books[i % 5];
    oItem.quantity = 2;
    oItem.price = books[i % 5].price;
    oItem.subTotal = Number(oItem.price) * oItem.quantity;
    await orderItemRepo.save(oItem);

    const payment = new Payment();
    payment.order = savedOrder;
    payment.amount = savedOrder.totalAmount;
    payment.method = PaymentMethod.CREDIT_CARD;
    payment.status = PaymentStatus.PENDING;
    await paymentRepo.save(payment);
  }

  // 9. Tạo UserBehavior
  console.log('🔍 Tạo Behaviors...');
  const behaviorRepo = AppDataSource.getRepository(UserBehavior);
  for (let i = 0; i < 5; i++) {
    const bhv = new UserBehavior();
    bhv.user = users[i];
    bhv.book = books[i % 5];
    bhv.behaviorType = BehaviorType.VIEW;
    await behaviorRepo.save(bhv);
  }

  console.log('✅✅ Hoàn tất Seed Database thành công!');
  if (destroyDataSource && AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

if (require.main === module) {
  runSeed().catch(err => {
    console.error('❌ Lỗi khi seed data:', err);
    process.exit(1);
  });
}
