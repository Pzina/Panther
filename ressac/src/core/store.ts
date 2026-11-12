/**
 * Extension point for real-money in-app purchases. Deliberately empty: RESSAC ships with an
 * in-game currency only. A native implementation (StoreKit / Google Play Billing through a
 * Capacitor plugin) can implement this interface later without touching the game rules.
 */
export interface StoreProduct {
  id: string;
  title: string;
  price: string;
}

export interface Store {
  readonly available: boolean;
  products(): Promise<StoreProduct[]>;
  purchase(productId: string): Promise<{ ok: boolean }>;
  restore(): Promise<string[]>;
}

/** The only store bundled with the game: it sells nothing. */
export const noStore: Store = {
  available: false,
  products: async () => [],
  purchase: async () => ({ ok: false }),
  restore: async () => [],
};
