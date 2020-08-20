import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Invalid customer.');
    }

    const productArray = await this.productsRepository.findAllById(products);

    if (productArray.length !== products.length) {
      throw new AppError('Invalid products');
    }

    const existentProductIds = productArray.map(product => product.id);

    const checkInexistentProducts = productArray.filter(
      product => !existentProductIds.includes(product.id),
    );

    if (checkInexistentProducts.length) {
      throw new AppError(
        `Could not find product ${checkInexistentProducts[0].id}`,
      );
    }

    const checkProductAvailability = products.filter(
      product =>
        productArray.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (checkProductAvailability.length) {
      throw new AppError(
        `The quantity ${checkProductAvailability[0].quantity} is not available for ${checkProductAvailability[0].id}`,
      );
    }

    const finalProductList = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productArray.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: finalProductList,
    });

    const { order_products } = order;

    const orderedProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        productArray.filter(p => p.id === product.product_id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
