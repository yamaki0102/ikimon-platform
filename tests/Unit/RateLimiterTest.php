<?php

use PHPUnit\Framework\TestCase;

/**
 * Unit tests for RateLimiter
 * FB-12: Test rate limiting functionality
 */
class RateLimiterTest extends TestCase
{
    private $testStorageDir;
    
    protected function setUp(): void
    {
        // Use a test-specific storage directory
        $this->testStorageDir = DATA_DIR . '/rate_limits';
        if (!is_dir($this->testStorageDir)) {
            mkdir($this->testStorageDir, 0777, true);
        }
    }
    
    protected function tearDown(): void
    {
        // Clean up test files
        $files = glob($this->testStorageDir . '/*.json');
        foreach ($files as $file) {
            unlink($file);
        }
    }
    
    public function testGetStatusReturnsArray(): void
    {
        $status = RateLimiter::getStatus();
        
        $this->assertIsArray($status);
        $this->assertArrayHasKey('limit', $status);
        $this->assertArrayHasKey('used', $status);
        $this->assertArrayHasKey('remaining', $status);
    }
    
    public function testLimitIsPositiveInteger(): void
    {
        $status = RateLimiter::getStatus();
        
        $this->assertIsInt($status['limit']);
        $this->assertGreaterThan(0, $status['limit']);
    }
    
    public function testRemainingDoesNotExceedLimit(): void
    {
        $status = RateLimiter::getStatus();
        
        $this->assertLessThanOrEqual($status['limit'], $status['remaining'] + $status['used']);
    }
    
    public function testCheckReturnsBoolean(): void
    {
        // Don't exit on exceed for testing
        $result = RateLimiter::check(false);
        
        $this->assertIsBool($result);
    }
    
    public function testCleanupDoesNotThrowException(): void
    {
        $this->expectNotToPerformAssertions();
        RateLimiter::cleanup();
    }
}
