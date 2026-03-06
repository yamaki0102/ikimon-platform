<?php

use PHPUnit\Framework\TestCase;

class CsrfTest extends TestCase
{
    protected function setUp(): void
    {
        $_COOKIE = [];
        $_SERVER['SERVER_PORT'] = 80;
    }

    public function testGenerateReturnsToken(): void
    {
        $token = CSRF::generate();

        $this->assertIsString($token);
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $token);
        $this->assertSame($token, $_COOKIE[CSRF::COOKIE_NAME] ?? null);
    }

    public function testValidateAcceptsValidTokenAndRejectsInvalid(): void
    {
        $token = CSRF::generate();

        $this->assertTrue(CSRF::validate($token));
        $this->assertFalse(CSRF::validate('invalid_token'));
    }
}
