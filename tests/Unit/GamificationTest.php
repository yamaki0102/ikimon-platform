<?php

use PHPUnit\Framework\TestCase;

/**
 * Unit tests for Gamification
 * Test badge logic and score calculations
 */
class GamificationTest extends TestCase
{
    public function testGetBadgesReturnsArray(): void
    {
        $badges = Gamification::getBadges();
        
        $this->assertIsArray($badges);
        $this->assertNotEmpty($badges);
    }
    
    public function testBadgeHasRequiredKeys(): void
    {
        $badges = Gamification::getBadges();
        $firstBadge = reset($badges);
        
        $this->assertArrayHasKey('name', $firstBadge);
        $this->assertArrayHasKey('icon', $firstBadge);
        $this->assertArrayHasKey('condition', $firstBadge);
    }
    
    public function testBadgeNamesAreUserFriendly(): void
    {
        $badges = Gamification::getBadges();
        
        // Check that badge names don't contain "同定者" (old terminology)
        foreach ($badges as $badgeId => $badge) {
            $this->assertStringNotContainsString(
                '同定者', 
                $badge['name'],
                "Badge '$badgeId' still contains old terminology"
            );
        }
    }
    
    public function testEarnedBadgesReturnsArray(): void
    {
        $mockUser = [
            'id' => 'test_user',
            'post_count' => 5,
            'id_count' => 3
        ];
        
        $earned = Gamification::getEarnedBadges($mockUser);
        
        $this->assertIsArray($earned);
    }
    
    public function testNewUserHasNoBadges(): void
    {
        $newUser = [
            'id' => 'new_user',
            'post_count' => 0,
            'id_count' => 0
        ];
        
        $earned = Gamification::getEarnedBadges($newUser);
        
        $this->assertEmpty($earned);
    }
    
    public function testActiveUserEarnsFirstBadge(): void
    {
        $activeUser = [
            'id' => 'active_user',
            'post_count' => 1,
            'id_count' => 0
        ];
        
        $earned = Gamification::getEarnedBadges($activeUser);
        
        $this->assertNotEmpty($earned, 'User with 1 post should earn the beginner badge');
    }
}
