"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.overview = overview;
exports.submissionsAnalytics = submissionsAnalytics;
exports.usersAnalytics = usersAnalytics;
const db_1 = require("../../config/db");
const redis_1 = require("../../config/redis");
function dayKey(date) {
    return date.toISOString().slice(0, 10);
}
function weekKey(date) {
    const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = copy.getUTCDay() || 7;
    copy.setUTCDate(copy.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((copy.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${copy.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
async function overview() {
    const cached = await redis_1.redis.get('analytics:overview');
    if (cached)
        return JSON.parse(cached);
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [usersByRole, activeUsers, totalCourses, totalSubmissions, submissionsByVerdict, recentActivity] = await Promise.all([
        db_1.prisma.user.groupBy({ by: ['role'], _count: { role: true } }),
        db_1.prisma.user.count({ where: { updatedAt: { gte: since30 } } }),
        db_1.prisma.course.count(),
        db_1.prisma.submission.count(),
        db_1.prisma.submission.groupBy({ by: ['verdict'], _count: { verdict: true } }),
        db_1.prisma.submission.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                id: true,
                status: true,
                verdict: true,
                createdAt: true,
                user: { select: { id: true, name: true } },
                problem: { select: { id: true, title: true } }
            }
        })
    ]);
    const data = {
        totalUsers: Object.fromEntries(usersByRole.map((row) => [row.role, row._count.role])),
        activeUsers,
        totalCourses,
        totalSubmissions,
        submissionsByVerdict: Object.fromEntries(submissionsByVerdict.map((row) => [row.verdict ?? 'pending', row._count.verdict])),
        recentActivity
    };
    await redis_1.redis.setex('analytics:overview', 300, JSON.stringify(data));
    return data;
}
async function submissionsAnalytics() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const submissions = await db_1.prisma.submission.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, verdict: true }
    });
    const byDay = new Map();
    for (let i = 29; i >= 0; i -= 1) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = dayKey(date);
        byDay.set(key, { date: key, total: 0, accepted: 0 });
    }
    for (const submission of submissions) {
        const key = dayKey(submission.createdAt);
        const row = byDay.get(key);
        if (row) {
            row.total += 1;
            if (submission.verdict === 'accepted')
                row.accepted += 1;
        }
    }
    return Array.from(byDay.values());
}
async function usersAnalytics() {
    const since = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000);
    const [countsByRole, users] = await Promise.all([
        db_1.prisma.user.groupBy({ by: ['role'], _count: { role: true } }),
        db_1.prisma.user.findMany({
            where: { createdAt: { gte: since } },
            select: { createdAt: true }
        })
    ]);
    const newUsersPerWeek = new Map();
    for (let i = 7; i >= 0; i -= 1) {
        const date = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
        newUsersPerWeek.set(weekKey(date), 0);
    }
    for (const user of users) {
        const key = weekKey(user.createdAt);
        newUsersPerWeek.set(key, (newUsersPerWeek.get(key) ?? 0) + 1);
    }
    return {
        countsByRole: Object.fromEntries(countsByRole.map((row) => [row.role, row._count.role])),
        newUsersPerWeek: Array.from(newUsersPerWeek.entries()).map(([week, count]) => ({ week, count }))
    };
}
