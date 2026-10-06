/**
 * Mock APIs: mock.shop (Shopify's demo GraphQL store) and dummyjson (users,
 * orders). Every function maps the response to a small, page-shaped object:
 * whatever a server loader returns is serialized into the page, so ship only
 * what the page shows.
 */

export type ProductSummary = {
  handle: string;
  title: string;
  image: string;
  price: string;
};

export type ProductDetail = ProductSummary & {
  description: string;
};

export type CollectionSummary = {
  handle: string;
  title: string;
  products: ProductSummary[];
};

export type User = {
  id: number;
  name: string;
  email: string;
  image: string;
};

export type Order = {
  id: number;
  total: string;
  items: { title: string; quantity: number }[];
};

type ShopProduct = {
  handle: string;
  title: string;
  description?: string;
  featuredImage: { url: string } | null;
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
};

type Edges<T> = { edges: { node: T }[] };

const PRODUCT_FIELDS =
  'handle title featuredImage { url } priceRange { minVariantPrice { amount currencyCode } }';

const money = (amount: string | number, currency: string) =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).format(
    Number(amount),
  );

async function shop<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch('https://mock.shop/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(`mock.shop answered ${response.status}`);
  }

  return ((await response.json()) as { data: T }).data;
}

function summary(product: ShopProduct): ProductSummary {
  const { amount, currencyCode } = product.priceRange.minVariantPrice;

  return {
    handle: product.handle,
    title: product.title,
    image: product.featuredImage
      ? `${product.featuredImage.url}?width=480`
      : '',
    price: money(amount, currencyCode),
  };
}

function summaries(products: Edges<ShopProduct>) {
  const list: ProductSummary[] = [];
  for (const { node } of products.edges) {
    list.push(summary(node));
  }

  return list;
}

export async function featuredCollections(): Promise<CollectionSummary[]> {
  const data = await shop<{
    collections: Edges<{
      handle: string;
      title: string;
      products: Edges<ShopProduct>;
    }>;
  }>(
    `{ collections(first: 4) { edges { node { handle title products(first: 4) { edges { node { ${PRODUCT_FIELDS} } } } } } } }`,
  );
  const list: CollectionSummary[] = [];
  for (const { node } of data.collections.edges) {
    list.push({
      handle: node.handle,
      title: node.title,
      products: summaries(node.products),
    });
  }

  return list;
}

export async function collection(
  handle: string,
): Promise<CollectionSummary | null> {
  const data = await shop<{
    collection: {
      handle: string;
      title: string;
      products: Edges<ShopProduct>;
    } | null;
  }>(
    `query ($handle: String!) { collection(handle: $handle) { handle title products(first: 24) { edges { node { ${PRODUCT_FIELDS} } } } } }`,
    { handle },
  );
  const found = data.collection;

  return (
    found && {
      handle: found.handle,
      title: found.title,
      products: summaries(found.products),
    }
  );
}

export async function product(handle: string): Promise<ProductDetail | null> {
  const data = await shop<{ product: ShopProduct | null }>(
    `query ($handle: String!) { product(handle: $handle) { description ${PRODUCT_FIELDS} } }`,
    { handle },
  );

  return (
    data.product && {
      ...summary(data.product),
      description: data.product.description ?? '',
    }
  );
}

/** Called from the browser: search results are per visitor, nothing to prerender or cache. */
export async function searchProducts(term: string) {
  const data = await shop<{ products: Edges<ShopProduct> }>(
    `query ($term: String!) { products(first: 12, query: $term) { edges { node { ${PRODUCT_FIELDS} } } } }`,
    { term },
  );

  return summaries(data.products);
}

export async function user(id: number): Promise<User> {
  const response = await fetch(
    `https://dummyjson.com/users/${id}?select=firstName,lastName,email,image`,
  );
  const data = (await response.json()) as {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    image: string;
  };

  return {
    id: data.id,
    name: `${data.firstName} ${data.lastName}`,
    email: data.email,
    image: data.image,
  };
}

export async function orders(userId: number): Promise<Order[]> {
  const response = await fetch(`https://dummyjson.com/carts/user/${userId}`);
  const data = (await response.json()) as {
    carts: {
      id: number;
      total: number;
      products: { title: string; quantity: number }[];
    }[];
  };
  const list: Order[] = [];
  for (const cart of data.carts) {
    const items: Order['items'] = [];
    for (const item of cart.products) {
      items.push({ title: item.title, quantity: item.quantity });
    }
    list.push({ id: cart.id, total: money(cart.total, 'USD'), items });
  }

  return list;
}
