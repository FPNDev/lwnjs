import { serverToken } from 'lwnjs/ssr';
import type { CollectionSummary, Order, ProductDetail, User } from './api';

// Page data loaded by server routes (src/server-routes.ts), read with `useServer` during setup.
export const FeaturedData = serverToken<CollectionSummary[]>('featured');
export const CollectionData = serverToken<CollectionSummary | null>(
  'collection',
);
export const ProductData = serverToken<ProductDetail | null>('product');
export const UserData = serverToken<User>('user');
export const OrdersData = serverToken<Order[]>('orders');
