
import { db } from '../client.js';

export async function getSetting(key) {
  const row = await db.selectFrom('settings')
    .select('value')
    .where('key', '=', key)
    .executeTakeFirst();
  return row ? JSON.parse(row.value) : null;
}

export async function setSetting(key, value) {
  await db.insertInto('settings')
    .values({ key, value: JSON.stringify(value) })
    .onConflict(oc => oc.column('key').doUpdateSet({ value: JSON.stringify(value) }))
    .execute();
}

export const saveSetting = setSetting;

// --- Linked Accounts Management ---

export async function getLinkedAccounts(platform) {
  let query = db.selectFrom('linked_accounts').selectAll();
  if (platform) {
    query = query.where('platform', '=', platform);
  }
  return await query.execute();
}

export async function saveLinkedAccount(account) {
  await db.insertInto('linked_accounts')
    .values(account)
    .onConflict(oc => oc.columns(['platform', 'external_id']).doUpdateSet({
      username: (eb) => eb.ref('excluded.username'),
      avatar_url: (eb) => eb.ref('excluded.avatar_url'),
      auth_data: (eb) => eb.ref('excluded.auth_data')
    }))
    .execute();
}

export async function removeLinkedAccount(id) {
  await db.deleteFrom('linked_accounts').where('id', '=', Number(id)).execute();
}
