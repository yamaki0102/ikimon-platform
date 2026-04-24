<?php

use PHPUnit\Framework\TestCase;

class BioUtilsResolvedTaxonTest extends TestCase
{
    public function testUnresolvedTaxonNameDoesNotCountAsResolved(): void
    {
        $this->assertFalse(BioUtils::hasResolvedTaxon([
            'taxon' => ['name' => 'Unresolved'],
            'identifications' => [],
        ]));
    }

    public function testIdentificationStillCountsWhenTaxonNameIsUnresolved(): void
    {
        $this->assertTrue(BioUtils::hasResolvedTaxon([
            'taxon' => ['name' => 'Unresolved'],
            'identifications' => [
                ['taxon_name' => 'モンシロチョウ'],
            ],
        ]));
    }
}
