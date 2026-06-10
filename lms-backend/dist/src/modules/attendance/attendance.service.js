"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAttendanceSessions = listAttendanceSessions;
exports.createAttendanceSession = createAttendanceSession;
exports.closeAttendanceSession = closeAttendanceSession;
exports.markAttendance = markAttendance;
const db_1 = require("../../config/db");
const apiError_1 = require("../../utils/apiError");
async function listAttendanceSessions(batchId) {
    const where = batchId ? { batchId } : {};
    return db_1.prisma.attendanceSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { marks: true }
    });
}
async function createAttendanceSession(data) {
    return db_1.prisma.attendanceSession.create({ data });
}
async function closeAttendanceSession(sessionId) {
    const s = await db_1.prisma.attendanceSession.findUnique({ where: { id: sessionId } });
    if (!s)
        throw (0, apiError_1.notFound)('Session not found');
    return db_1.prisma.attendanceSession.update({ where: { id: sessionId }, data: { status: 'closed' } });
}
async function markAttendance(requester, sessionId) {
    // Ensure session exists and is open
    const session = await db_1.prisma.attendanceSession.findUnique({ where: { id: sessionId } });
    if (!session)
        throw (0, apiError_1.notFound)('Session not found');
    if (session.status !== 'open')
        throw (0, apiError_1.forbidden)('Session is closed');
    // Upsert mark (unique constraint prevents duplicates)
    return db_1.prisma.attendanceMark.upsert({
        where: { sessionId_userId: { sessionId, userId: requester.id } },
        update: { markedAt: new Date() },
        create: { sessionId, userId: requester.id }
    });
}
