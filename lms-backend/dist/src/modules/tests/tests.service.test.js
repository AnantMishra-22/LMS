"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const { prismaMock } = vitest_1.vi.hoisted(() => ({
    prismaMock: {
        test: {
            findUnique: vitest_1.vi.fn(),
            create: vitest_1.vi.fn(),
            update: vitest_1.vi.fn()
        },
        testAttempt: {
            findUnique: vitest_1.vi.fn(),
            create: vitest_1.vi.fn(),
            update: vitest_1.vi.fn()
        },
        batchEnrollment: {
            findUnique: vitest_1.vi.fn()
        }
    }
}));
vitest_1.vi.mock('@/config/db', () => ({
    prisma: prismaMock
}));
const tests_service_1 = require("./tests.service");
const student = { id: 'student-1', role: 'student' };
(0, vitest_1.describe)('test attempt timing authority', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.useFakeTimers();
        vitest_1.vi.setSystemTime(new Date('2026-05-13T10:00:00.000Z'));
        prismaMock.batchEnrollment.findUnique.mockResolvedValue({ id: 'enrollment-1' });
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.useRealTimers();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('returns an existing active attempt instead of creating duplicate timing state', async () => {
        const existing = {
            id: 'attempt-1',
            testId: 'test-1',
            userId: 'student-1',
            startedAt: new Date('2026-05-13T09:55:00.000Z'),
            expiresAt: new Date('2026-05-13T10:55:00.000Z'),
            durationSeconds: 3600,
            status: 'active',
            submittedAt: null
        };
        prismaMock.test.findUnique.mockResolvedValue({
            id: 'test-1',
            batchId: 'batch-1',
            startTime: new Date('2026-05-13T09:00:00.000Z'),
            endTime: new Date('2026-05-13T12:00:00.000Z'),
            durationSeconds: 3600
        });
        prismaMock.testAttempt.findUnique.mockResolvedValue(existing);
        await (0, vitest_1.expect)((0, tests_service_1.startAttempt)('test-1', student)).resolves.toMatchObject({
            id: 'attempt-1',
            expiresAt: existing.expiresAt,
            serverNow: new Date('2026-05-13T10:00:00.000Z')
        });
        (0, vitest_1.expect)(prismaMock.testAttempt.create).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('derives and persists expiresAt when starting a new attempt', async () => {
        prismaMock.test.findUnique.mockResolvedValue({
            id: 'test-1',
            batchId: 'batch-1',
            startTime: null,
            endTime: new Date('2026-05-13T10:30:00.000Z'),
            durationSeconds: 3600
        });
        prismaMock.testAttempt.findUnique.mockResolvedValue(null);
        prismaMock.testAttempt.create.mockImplementation(async ({ data }) => ({
            id: 'attempt-2',
            testId: data.testId,
            userId: data.userId,
            startedAt: data.startedAt,
            expiresAt: data.expiresAt,
            durationSeconds: data.durationSeconds,
            status: data.status,
            submittedAt: null
        }));
        await (0, vitest_1.expect)((0, tests_service_1.startAttempt)('test-1', student)).resolves.toMatchObject({
            id: 'attempt-2',
            startedAt: new Date('2026-05-13T10:00:00.000Z'),
            expiresAt: new Date('2026-05-13T10:30:00.000Z'),
            durationSeconds: 3600,
            status: 'active',
            serverNow: new Date('2026-05-13T10:00:00.000Z')
        });
    });
    (0, vitest_1.it)('marks active attempts expired during hydration after expiresAt passes', async () => {
        prismaMock.test.findUnique.mockResolvedValue({ id: 'test-1', batchId: 'batch-1' });
        prismaMock.testAttempt.findUnique.mockResolvedValue({
            id: 'attempt-3',
            testId: 'test-1',
            userId: 'student-1',
            startedAt: new Date('2026-05-13T09:00:00.000Z'),
            expiresAt: new Date('2026-05-13T09:30:00.000Z'),
            durationSeconds: 1800,
            status: 'active',
            submittedAt: null
        });
        prismaMock.testAttempt.update.mockResolvedValue({
            id: 'attempt-3',
            testId: 'test-1',
            userId: 'student-1',
            startedAt: new Date('2026-05-13T09:00:00.000Z'),
            expiresAt: new Date('2026-05-13T09:30:00.000Z'),
            durationSeconds: 1800,
            status: 'expired',
            submittedAt: null
        });
        await (0, vitest_1.expect)((0, tests_service_1.getActiveAttempt)('test-1', student)).resolves.toMatchObject({
            id: 'attempt-3',
            status: 'expired',
            serverNow: new Date('2026-05-13T10:00:00.000Z')
        });
    });
    (0, vitest_1.it)('rejects submit after persisted expiresAt and marks the attempt expired', async () => {
        prismaMock.test.findUnique.mockResolvedValue({
            id: 'test-1',
            batchId: 'batch-1',
            startTime: null,
            endTime: null,
            durationSeconds: 1800,
            questions: [{ id: 'question-1', answer: 'a', points: 1 }]
        });
        prismaMock.testAttempt.findUnique.mockResolvedValue({
            id: 'attempt-4',
            submittedAt: null,
            status: 'active',
            expiresAt: new Date('2026-05-13T09:30:00.000Z')
        });
        prismaMock.testAttempt.update.mockResolvedValue({
            id: 'attempt-4',
            testId: 'test-1',
            userId: 'student-1',
            startedAt: new Date('2026-05-13T09:00:00.000Z'),
            expiresAt: new Date('2026-05-13T09:30:00.000Z'),
            durationSeconds: 1800,
            status: 'expired',
            submittedAt: null
        });
        await (0, vitest_1.expect)((0, tests_service_1.submitAttempt)('test-1', student, { 'question-1': 'a' })).rejects.toThrow('Attempt has expired');
        (0, vitest_1.expect)(prismaMock.testAttempt.update).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            where: { id: 'attempt-4' },
            data: { status: 'expired' }
        }));
    });
});
