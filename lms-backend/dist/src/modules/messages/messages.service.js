"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listInbox = listInbox;
exports.getThread = getThread;
exports.sendMessage = sendMessage;
exports.markRead = markRead;
exports.unreadCount = unreadCount;
const db_1 = require("../../config/db");
const apiError_1 = require("../../utils/apiError");
async function listInbox(userId) {
    const messages = await db_1.prisma.message.findMany({
        where: {
            OR: [{ senderId: userId }, { receiverId: userId }]
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
            id: true,
            senderId: true,
            receiverId: true,
            content: true,
            isRead: true,
            createdAt: true,
            sender: { select: { id: true, name: true, avatarUrl: true } },
            receiver: { select: { id: true, name: true, avatarUrl: true } }
        }
    });
    const conversations = new Map();
    for (const message of messages) {
        const otherUserId = message.senderId === userId ? message.receiverId : message.senderId;
        const existing = conversations.get(otherUserId);
        const unreadIncrement = message.receiverId === userId && !message.isRead ? 1 : 0;
        if (!existing) {
            conversations.set(otherUserId, { ...message, unreadCount: unreadIncrement });
        }
        else {
            existing.unreadCount += unreadIncrement;
        }
    }
    return Array.from(conversations.values());
}
async function getThread(userId, otherUserId, page, limit) {
    const skip = (page - 1) * limit;
    await db_1.prisma.message.updateMany({
        where: {
            senderId: otherUserId,
            receiverId: userId,
            isRead: false
        },
        data: { isRead: true }
    });
    const [total, items] = await db_1.prisma.$transaction([
        db_1.prisma.message.count({
            where: {
                OR: [
                    { senderId: userId, receiverId: otherUserId },
                    { senderId: otherUserId, receiverId: userId }
                ]
            }
        }),
        db_1.prisma.message.findMany({
            where: {
                OR: [
                    { senderId: userId, receiverId: otherUserId },
                    { senderId: otherUserId, receiverId: userId }
                ]
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            select: {
                id: true,
                senderId: true,
                receiverId: true,
                content: true,
                isRead: true,
                createdAt: true
            }
        })
    ]);
    return { page, limit, total, items };
}
async function sendMessage(senderId, input) {
    const receiver = await db_1.prisma.user.findUnique({
        where: { id: input.receiverId },
        select: { id: true }
    });
    if (!receiver)
        throw (0, apiError_1.notFound)('Not found');
    return db_1.prisma.message.create({
        data: {
            senderId,
            receiverId: input.receiverId,
            content: input.content
        },
        select: {
            id: true,
            senderId: true,
            receiverId: true,
            content: true,
            isRead: true,
            createdAt: true
        }
    });
}
async function markRead(userId, messageId) {
    const message = await db_1.prisma.message.findUnique({
        where: { id: messageId },
        select: { id: true, receiverId: true }
    });
    if (!message)
        throw (0, apiError_1.notFound)('Not found');
    if (message.receiverId !== userId)
        throw (0, apiError_1.forbidden)('Forbidden');
    return db_1.prisma.message.update({
        where: { id: messageId },
        data: { isRead: true },
        select: {
            id: true,
            senderId: true,
            receiverId: true,
            content: true,
            isRead: true,
            createdAt: true
        }
    });
}
async function unreadCount(userId) {
    const count = await db_1.prisma.message.count({
        where: {
            receiverId: userId,
            isRead: false
        }
    });
    return { count };
}
