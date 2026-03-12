<?php

require_once __DIR__ . '/DataStore.php';

class AiBudgetGuard
{
    private const FILE = 'system/ai_budget_daily';
    private const DEFAULT_DAILY_BUDGETS = [
        'fast' => 0.06,
        'batch' => 0.09,
        'deep' => 0.03,
    ];

    public static function canSpend(string $lane, float $estimatedCost, ?string $day = null): bool
    {
        $lane = self::normalizeLane($lane);
        $day = $day ?: date('Y-m-d');
        $state = self::loadState();
        $spent = (float)($state[$day]['spent'][$lane] ?? 0.0);
        return ($spent + $estimatedCost) <= self::dailyBudget($lane);
    }

    public static function commit(string $lane, float $estimatedCost, string $jobId, ?string $day = null): array
    {
        $lane = self::normalizeLane($lane);
        $day = $day ?: date('Y-m-d');
        $state = self::loadState();

        if (!isset($state[$day])) {
            $state[$day] = [
                'day' => $day,
                'spent' => [],
                'jobs' => [],
                'updated_at' => date('c'),
            ];
        }

        $spent = (float)($state[$day]['spent'][$lane] ?? 0.0);
        $state[$day]['spent'][$lane] = round($spent + $estimatedCost, 6);
        $state[$day]['jobs'][$jobId] = [
            'lane' => $lane,
            'estimated_cost_usd' => round($estimatedCost, 6),
            'updated_at' => date('c'),
        ];
        $state[$day]['updated_at'] = date('c');

        self::pruneOldDays($state);
        DataStore::save(self::FILE, $state);

        return [
            'lane' => $lane,
            'day' => $day,
            'spent' => (float)$state[$day]['spent'][$lane],
            'budget' => self::dailyBudget($lane),
        ];
    }

    public static function snapshot(?string $day = null): array
    {
        $day = $day ?: date('Y-m-d');
        $state = self::loadState();
        $spent = $state[$day]['spent'] ?? [];

        return [
            'day' => $day,
            'spent' => [
                'fast' => (float)($spent['fast'] ?? 0.0),
                'batch' => (float)($spent['batch'] ?? 0.0),
                'deep' => (float)($spent['deep'] ?? 0.0),
            ],
            'budget' => [
                'fast' => self::dailyBudget('fast'),
                'batch' => self::dailyBudget('batch'),
                'deep' => self::dailyBudget('deep'),
            ],
        ];
    }

    public static function dailyBudget(string $lane): float
    {
        $lane = self::normalizeLane($lane);
        $envKey = 'IKIMON_AI_' . strtoupper($lane) . '_DAILY_BUDGET_USD';
        $value = getenv($envKey);
        if ($value === false || $value === '') {
            $value = $_SERVER[$envKey] ?? $_ENV[$envKey] ?? null;
        }

        $budget = is_numeric($value) ? (float)$value : (self::DEFAULT_DAILY_BUDGETS[$lane] ?? self::DEFAULT_DAILY_BUDGETS['fast']);
        return max(0.0, round($budget, 6));
    }

    private static function loadState(): array
    {
        $state = DataStore::get(self::FILE, 0);
        return is_array($state) ? $state : [];
    }

    private static function pruneOldDays(array &$state): void
    {
        $cutoff = strtotime('-14 days');
        foreach (array_keys($state) as $day) {
            $timestamp = strtotime((string)$day);
            if ($timestamp !== false && $timestamp < $cutoff) {
                unset($state[$day]);
            }
        }
    }

    private static function normalizeLane(string $lane): string
    {
        return in_array($lane, ['fast', 'batch', 'deep'], true) ? $lane : 'fast';
    }
}
