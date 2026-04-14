<?php

use PHPUnit\Framework\TestCase;

class CanonicalMachineObservationPolicyTest extends TestCase
{
    public function testEvaluateAllowsOfficialFieldSession(): void
    {
        $result = CanonicalMachineObservationPolicy::evaluate([
            'session_intent' => 'official',
            'official_record' => true,
            'test_profile' => 'field',
        ]);

        $this->assertTrue($result['enabled']);
        $this->assertNull($result['reason']);
    }

    public function testEvaluateBlocksNonOfficialSessionIntent(): void
    {
        $result = CanonicalMachineObservationPolicy::evaluate([
            'session_intent' => 'test',
            'official_record' => true,
            'test_profile' => 'field',
        ]);

        $this->assertFalse($result['enabled']);
        $this->assertSame('session_intent_not_official', $result['reason']);
    }

    public function testEvaluateBlocksNonFieldTestProfile(): void
    {
        $result = CanonicalMachineObservationPolicy::evaluate([
            'session_intent' => 'official',
            'official_record' => true,
            'test_profile' => 'lab',
        ]);

        $this->assertFalse($result['enabled']);
        $this->assertSame('test_profile_not_field', $result['reason']);
    }
}
