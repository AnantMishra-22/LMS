"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveSubscription = getActiveSubscription;
exports.createSubscription = createSubscription;
exports.updateSubscription = updateSubscription;
const db_1 = require("../../config/db");
async function getActiveSubscription(institutionId) {
    return db_1.prisma.subscription.findFirst({
        where: {
            ...(institutionId ? { institutionId } : {}),
            status: 'active',
            expiresAt: { gte: new Date() }
        },
        orderBy: { expiresAt: 'desc' },
        select: {
            id: true,
            institutionId: true,
            plan: true,
            status: true,
            startsAt: true,
            expiresAt: true,
            createdAt: true,
            institution: { select: { id: true, name: true } }
        }
    });
}
async function createSubscription(input) {
    return db_1.prisma.subscription.create({
        data: input,
        select: {
            id: true,
            institutionId: true,
            plan: true,
            status: true,
            startsAt: true,
            expiresAt: true,
            createdAt: true
        }
    });
}
async function updateSubscription(id, input) {
    return db_1.prisma.subscription.update({
        where: { id },
        data: {
            ...(typeof input.plan === 'string' ? { plan: input.plan } : {}),
            ...(typeof input.status === 'string' ? { status: input.status } : {}),
            ...(input.startsAt instanceof Date ? { startsAt: input.startsAt } : {}),
            ...(input.expiresAt instanceof Date ? { expiresAt: input.expiresAt } : {})
        },
        select: {
            id: true,
            institutionId: true,
            plan: true,
            status: true,
            startsAt: true,
            expiresAt: true,
            createdAt: true
        }
    });
}
