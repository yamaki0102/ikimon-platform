<?php

require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/SurveyorManager.php';

class SurveyRequestManager
{
    public static function normalizeInput(array $input): array
    {
        $preferredDays = array_values(array_filter(array_map('trim', (array)($input['preferred_days'] ?? []))));

        $travelCondition = trim((string)($input['travel_condition'] ?? ''));
        $allowedTravelConditions = ['', '近隣のみ', '市内中心', '県内広域', '隣県まで', '全国対応'];
        if (!in_array($travelCondition, $allowedTravelConditions, true)) {
            $travelCondition = '';
        }

        $budgetStance = trim((string)($input['budget_stance'] ?? ''));
        $allowedBudgetStances = ['', '相談して決定', '半日相当', '1日相当', '報告書込み', '案件規模で見積もり'];
        if (!in_array($budgetStance, $allowedBudgetStances, true)) {
            $budgetStance = '';
        }

        return [
            'requester_name' => mb_substr(trim((string)($input['requester_name'] ?? '')), 0, 80),
            'contact' => mb_substr(trim((string)($input['contact'] ?? '')), 0, 120),
            'area' => mb_substr(trim((string)($input['area'] ?? '')), 0, 120),
            'specialty' => mb_substr(trim((string)($input['specialty'] ?? '')), 0, 120),
            'preferred_days' => array_slice($preferredDays, 0, 7),
            'travel_condition' => $travelCondition,
            'budget_stance' => $budgetStance,
            'budget' => mb_substr(trim((string)($input['budget'] ?? '')), 0, 80),
            'schedule' => mb_substr(trim((string)($input['schedule'] ?? '')), 0, 120),
            'notes' => mb_substr(trim((string)($input['notes'] ?? '')), 0, 1200),
        ];
    }

    public static function validate(array $request): array
    {
        $errors = [];
        foreach (['requester_name', 'contact', 'area', 'specialty'] as $required) {
            if ($request[$required] === '') {
                $errors[] = $required;
            }
        }
        return $errors;
    }

    public static function create(array $request): array
    {
        $record = $request + [
            'id' => uniqid('survey_request_'),
            'status' => 'new',
            'created_at' => date('Y-m-d H:i:s'),
            'matched_surveyor_ids' => array_map(fn(array $s): string => $s['id'], SurveyorManager::matchSurveyors([
                'area' => $request['area'],
                'specialty' => $request['specialty'],
                'q' => $request['notes'],
            ], 5)),
        ];

        $requests = DataStore::get('survey_requests');
        $requests[] = $record;
        DataStore::save('survey_requests', $requests);

        return $record;
    }
}
