"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsers = listUsers;
exports.createUser = createUser;
exports.getUserById = getUserById;
exports.updateUser = updateUser;
exports.updateUserFull = updateUserFull;
exports.softDeleteUser = softDeleteUser;
exports.presignAvatarUpload = presignAvatarUpload;
exports.resetUserPassword = resetUserPassword;
exports.updateUserStatus = updateUserStatus;
const bcrypt_1 = __importDefault(require("bcrypt"));
const uuid_1 = require("uuid");
const db_1 = require("../../config/db");
const env_1 = require("../../config/env");
const apiError_1 = require("../../utils/apiError");
const s3_1 = require("../../utils/s3");
const userRoleSchema = env_1.roleEnum;
function canAccessUser(requester, targetUserId) {
    return requester.role === 'admin' || requester.id === targetUserId;
}
async function listUsers(params) {
    const where = {
        ...(params.role ? { role: params.role } : {}),
        ...(params.search
            ? {
                OR: [
                    { name: { contains: params.search, mode: 'insensitive' } },
                    { email: { contains: params.search, mode: 'insensitive' } }
                ]
            }
            : {})
    };
    const skip = (params.page - 1) * params.limit;
    const [total, items] = await db_1.prisma.$transaction([
        db_1.prisma.user.count({ where }),
        db_1.prisma.user.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: params.limit,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                avatarUrl: true,
                isActive: true,
                createdAt: true,
                updatedAt: true
            }
        })
    ]);
    return {
        page: params.page,
        limit: params.limit,
        total,
        items
    };
}
async function createUser(input) {
    const passwordHash = await bcrypt_1.default.hash(input.password, env_1.env.BCRYPT_ROUNDS);
    return db_1.prisma.user.create({
        data: {
            email: input.email,
            passwordHash,
            name: input.name,
            role: input.role,
            institutionId: input.institutionId
        },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            avatarUrl: true,
            isActive: true,
            createdAt: true,
            updatedAt: true
        }
    });
}
async function getUserById(requester, id) {
    if (!canAccessUser(requester, id)) {
        throw (0, apiError_1.forbidden)('Forbidden');
    }
    const user = await db_1.prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            avatarUrl: true,
            isActive: true,
            createdAt: true,
            updatedAt: true
        }
    });
    if (!user)
        throw (0, apiError_1.notFound)('Not found');
    return user;
}
async function updateUser(requester, id, input) {
    if (!canAccessUser(requester, id)) {
        throw (0, apiError_1.forbidden)('Forbidden');
    }
    const data = {};
    if (typeof input.email === 'string')
        data.email = input.email;
    if (typeof input.name === 'string')
        data.name = input.name;
    if (input.avatarUrl === null || typeof input.avatarUrl === 'string')
        data.avatarUrl = input.avatarUrl;
    // Only admins can deactivate users.
    if (typeof input.isActive === 'boolean') {
        if (requester.role !== 'admin')
            throw (0, apiError_1.forbidden)('Forbidden');
        data.isActive = input.isActive;
    }
    return db_1.prisma.user.update({
        where: { id },
        data,
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            avatarUrl: true,
            isActive: true,
            createdAt: true,
            updatedAt: true
        }
    });
}
async function updateUserFull(requester, id, input) {
    // Only allow admin or owner to perform updates; role/institution changes require admin
    if (!canAccessUser(requester, id)) {
        throw (0, apiError_1.forbidden)('Forbidden');
    }
    const target = await db_1.prisma.user.findUnique({ where: { id } });
    if (!target)
        throw (0, apiError_1.notFound)('User not found');
    const data = {};
    // Email duplicate check
    if (typeof input.email === 'string') {
        const existing = await db_1.prisma.user.findUnique({ where: { email: input.email } });
        if (existing && existing.id !== id)
            throw (0, apiError_1.forbidden)('Email already in use');
        data.email = input.email;
    }
    if (typeof input.name === 'string')
        data.name = input.name;
    if (input.avatarUrl === null || typeof input.avatarUrl === 'string')
        data.avatarUrl = input.avatarUrl;
    // Institution validation (admin only to change)
    if (input.institutionId !== undefined) {
        if (requester.role !== 'admin')
            throw (0, apiError_1.forbidden)('Forbidden');
        if (input.institutionId !== null) {
            const inst = await db_1.prisma.institution.findUnique({ where: { id: input.institutionId } });
            if (!inst)
                throw (0, apiError_1.notFound)('Institution not found');
            data.institutionId = input.institutionId;
        }
        else {
            data.institutionId = null;
        }
    }
    // Role change (admin only)
    if (input.role !== undefined) {
        if (requester.role !== 'admin')
            throw (0, apiError_1.forbidden)('Forbidden');
        // Validate role value via enum - Type system ensures correctness
        data.role = input.role;
    }
    // Status change (only admin)
    if (typeof input.isActive === 'boolean') {
        if (requester.role !== 'admin')
            throw (0, apiError_1.forbidden)('Forbidden');
        data.isActive = input.isActive;
    }
    // Prevent removing/demoting/deactivating last admin
    const willDemoteOrDeactivateAdmin = (() => {
        if (target.role !== 'admin')
            return false;
        // if role set and not admin => demotion
        if (input.role !== undefined && input.role !== 'admin')
            return true;
        // if isActive explicitly false
        if (typeof input.isActive === 'boolean' && input.isActive === false)
            return true;
        return false;
    })();
    if (willDemoteOrDeactivateAdmin) {
        const otherActiveAdmins = await db_1.prisma.user.count({ where: { role: 'admin', isActive: true, NOT: { id } } });
        if (otherActiveAdmins === 0) {
            throw (0, apiError_1.forbidden)('Operation would remove the last active admin');
        }
    }
    const updated = await db_1.prisma.user.update({ where: { id }, data, select: {
            id: true,
            email: true,
            name: true,
            role: true,
            avatarUrl: true,
            isActive: true,
            institutionId: true,
            createdAt: true,
            updatedAt: true
        } });
    return updated;
}
async function softDeleteUser(id) {
    return db_1.prisma.user.update({
        where: { id },
        data: { isActive: false },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            avatarUrl: true,
            isActive: true,
            createdAt: true,
            updatedAt: true
        }
    });
}
async function presignAvatarUpload(userId, contentType) {
    const ext = (() => {
        if (contentType === 'image/png')
            return 'png';
        if (contentType === 'image/jpeg')
            return 'jpg';
        if (contentType === 'image/webp')
            return 'webp';
        return 'bin';
    })();
    const key = `avatars/${userId}/${(0, uuid_1.v4)()}.${ext}`;
    const presigned = await (0, s3_1.presignPutObject)({
        key,
        contentType,
        expiresInSeconds: 3600
    });
    await db_1.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: presigned.publicUrl }
    });
    return presigned;
}
async function resetUserPassword(userId, newPassword) {
    const hash = await bcrypt_1.default.hash(newPassword, env_1.env.BCRYPT_ROUNDS);
    return db_1.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: hash }
    });
}
async function updateUserStatus(userId, isActive) {
    return db_1.prisma.user.update({
        where: { id: userId },
        data: { isActive },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            avatarUrl: true,
            isActive: true,
            createdAt: true,
            updatedAt: true
        }
    });
}
