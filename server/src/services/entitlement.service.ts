import { Op, type Transaction } from 'sequelize';
import { UserEntitlement, Plan } from '@/models/index';

export interface PlanLimits {
  maxGroupMembers: number;
  realtimeChatEnabled: boolean;
  realtimeSyncEnabled: boolean;
}

export const getActiveEntitlement = async (userid: number | string, planCode: string) => {
  const plan = await Plan.findOne({ where: { code: planCode } });
  if (!plan) return null;

  return UserEntitlement.findOne({
    where: {
      userid: Number(userid),
      planid: plan.planid,
      status: 'ACTIVE',
      [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }],
    },
    include: [{ model: Plan, as: 'plan' }],
  });
};

export const createProEntitlement = async (
  userid: number | string,
  paymentid: number,
  transaction: Transaction | null = null
) => {
  const plan = await Plan.findOne({ where: { code: 'PRO' } });
  if (!plan) {
    throw new Error('PRO plan not found');
  }

  const numericUserId = Number(userid);
  const existing = await UserEntitlement.findOne({
    where: {
      userid: numericUserId,
      planid: plan.planid,
      status: 'ACTIVE',
      [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }],
    },
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });

  if (existing) {
    return { created: false, entitlement: existing };
  }

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const entitlement = await UserEntitlement.create(
    {
      userid: numericUserId,
      planid: plan.planid,
      paymentid,
      status: 'ACTIVE',
      startsAt: now,
      expiresAt,
    },
    { transaction: transaction ?? undefined }
  );

  return { created: true, entitlement };
};

export const hasFeatureAccess = async (
  userid: number | string,
  planCode: string
): Promise<boolean> => {
  const entitlement = await getActiveEntitlement(userid, planCode);
  return !!entitlement;
};

export const getUserEntitlement = async (userid: number | string) => {
  return UserEntitlement.findOne({
    where: {
      userid: Number(userid),
      status: 'ACTIVE',
      [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }],
    },
    include: [{ model: Plan, as: 'plan' }],
    order: [['createdAt', 'DESC']],
  });
};

export const getUserPlanLimits = async (userid: number | string): Promise<Plan | null> => {
  const entitlement = await getUserEntitlement(userid);
  const planFromAssoc = (entitlement as unknown as { plan?: Plan })?.plan;
  if (planFromAssoc) {
    return planFromAssoc;
  }
  return Plan.findOne({ where: { code: 'FREE' } });
};
