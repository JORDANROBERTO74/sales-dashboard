import { encrypt, decrypt } from "@/lib/crypto";

/**
 * Fields encrypted with AES-256-GCM before storage.
 * These contain financial account data or PII that could enable
 * fraud or identity theft if the database is compromised.
 *
 * Validation of format/values MUST happen BEFORE encryption
 * (the DB only sees opaque ciphertext after this layer).
 */
const ENCRYPTED_FIELDS = [
  "binance_id",
  "ach_account_holder",
  "ach_routing_number",
  "ach_account_number",
  "ach_bank_name",
  "ach_account_type",
  "qr_bank_name",
  "qr_account_holder",
  "qr_ci_number",
  "qr_account_number",
] as const;

export type EncryptedField = (typeof ENCRYPTED_FIELDS)[number];

type PaymentMethodRecord = Record<string, unknown>;

/**
 * Encrypts all sensitive financial fields in a payment method record.
 * Call this AFTER validation and BEFORE inserting/updating in Supabase.
 *
 * Non-string, null, or undefined fields are left untouched.
 *
 * @example
 * ```ts
 * const validated = validatePaymentMethod(formData);
 * const encrypted = encryptPaymentFields(validated);
 * await supabase.from('seller_payment_methods').insert(encrypted);
 * ```
 */
export function encryptPaymentFields<T extends PaymentMethodRecord>(
  data: T
): T {
  const result: PaymentMethodRecord = { ...data };

  for (const field of ENCRYPTED_FIELDS) {
    const value = result[field];
    if (typeof value === "string" && value.length > 0) {
      result[field] = encrypt(value);
    }
  }

  return result as T;
}

/**
 * Decrypts all sensitive financial fields in a payment method record.
 * Call this AFTER fetching from Supabase and BEFORE sending to the client.
 *
 * @example
 * ```ts
 * const { data } = await supabase.from('seller_payment_methods').select('*');
 * const decrypted = data.map(decryptPaymentFields);
 * ```
 */
export function decryptPaymentFields<T extends PaymentMethodRecord>(
  data: T
): T {
  const result: PaymentMethodRecord = { ...data };

  for (const field of ENCRYPTED_FIELDS) {
    const value = result[field];
    if (typeof value === "string" && value.length > 0) {
      result[field] = decrypt(value);
    }
  }

  return result as T;
}

/**
 * Returns the list of field names that are encrypted.
 * Useful for building partial update queries or masking in logs.
 */
export function getEncryptedFieldNames(): readonly EncryptedField[] {
  return ENCRYPTED_FIELDS;
}
