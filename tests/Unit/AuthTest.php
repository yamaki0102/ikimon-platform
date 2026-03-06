<?php

use PHPUnit\Framework\TestCase;

class AuthTest extends TestCase
{
    protected function setUp(): void
    {
        $_SESSION = [];
        $_COOKIE = [];
        $_SERVER['SERVER_PORT'] = 80;
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_unset();
            session_destroy();
        }
    }

    protected function tearDown(): void
    {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_unset();
            session_destroy();
        }
    }

    public function testInitDoesNotThrow(): void
    {
        $this->expectNotToPerformAssertions();
        Auth::init();
    }

    public function testGuestSessionInitialization(): void
    {
        Auth::initGuest();

        $this->assertTrue(Auth::isGuest());
        $guestId = Auth::getGuestId();
        $this->assertIsString($guestId);
        $this->assertStringStartsWith('guest_', $guestId);
        $this->assertSame(0, Auth::getGuestPostCount());
    }
}
