"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listInstitutions = listInstitutions;
exports.createInstitution = createInstitution;
exports.getInstitution = getInstitution;
exports.updateInstitution = updateInstitution;
exports.deleteInstitution = deleteInstitution;
const db_1 = require("../../config/db");
const apiError_1 = require("../../utils/apiError");
async function listInstitutions() {
    return db_1.prisma.institution.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            name: true,
            createdAt: true,
            _count: { select: { users: true, batches: true, subscriptions: true } }
        }
    });
}
async function createInstitution(input) {
    return db_1.prisma.institution.create({
        data: { name: input.name },
        select: { id: true, name: true, createdAt: true }
    });
}
async function getInstitution(id) {
    const institution = await db_1.prisma.institution.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            createdAt: true,
            _count: { select: { users: true, batches: true, subscriptions: true } }
        }
    });
    if (!institution)
        throw (0, apiError_1.notFound)('Not found');
    return institution;
}
async function updateInstitution(id, input) {
    return db_1.prisma.institution.update({
        where: { id },
        data: { name: input.name },
        select: { id: true, name: true, createdAt: true }
    });
}
async function deleteInstitution(id) {
    await db_1.prisma.institution.delete({ where: { id } });
    return { status: 'ok' };
}
