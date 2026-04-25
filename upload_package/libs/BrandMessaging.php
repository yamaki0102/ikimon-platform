<?php

final class BrandMessaging
{
    public static function regionalRevitalization(): array
    {
        if (class_exists('Lang') && method_exists('Lang', 'get')) {
            return [
                'about_meta_description' => __('regional_messaging.about_meta_description', '自然観察を通じた地域創生。消滅可能性自治体への無償提供、原体験から生まれたビジョン。ikimon.lifeが目指す未来。'),
                'business_meta_description' => __('regional_messaging.business_meta_description', '学校・地域団体は無料で運営開始。消滅可能性自治体には出力を含めて無償提供。企業・大規模自治体はPublicで継続運用を支えます。'),
                'disappearing_section_heading' => __('regional_messaging.disappearing_section_heading', '744の自治体が、消えるかもしれない'),
                'disappearing_population_copy' => __('regional_messaging.disappearing_population_copy', '2050年までに、20〜39歳の女性人口が50%以上減少すると推計される自治体——'),
                'disappearing_count_copy' => __('regional_messaging.disappearing_count_copy', 'いわゆる「消滅可能性自治体」が、全国で744。'),
                'disappearing_ratio_copy' => __('regional_messaging.disappearing_ratio_copy', '全自治体の、43%にあたります。'),
                'priority_lead' => __('regional_messaging.priority_lead', '最も危機的な自治体に、ikimon.lifeを届けたい。'),
                'eligibility_copy' => __('regional_messaging.eligibility_copy', '若年女性人口の減少率が80%を超える自治体——'),
                'support_model_summary' => __('regional_messaging.support_model_summary', '企業や大規模自治体向けのPublicプランの収益で、この無償提供を支えます。'),
                'free_plan' => [
                    'tag' => __('regional_messaging.free_plan.tag', '無償提供'),
                    'name' => __('regional_messaging.free_plan.name', '消滅可能性自治体（若年女性減少率80%以上）'),
                    'description' => __('regional_messaging.free_plan.description', 'プラットフォームのすべての機能を、完全無料で提供します。レポート出力・データエクスポートを含みます。'),
                ],
                'community_plan' => [
                    'tag' => __('regional_messaging.community_plan.tag', 'Community'),
                    'name' => __('regional_messaging.community_plan.name', '一般市民・小規模団体'),
                    'description' => __('regional_messaging.community_plan.description', '観察の投稿・同定・図鑑・観察会への参加まで無料。誰でもすぐに始められます。'),
                ],
                'public_plan' => [
                    'tag' => __('regional_messaging.public_plan.tag', 'Public'),
                    'name' => __('regional_messaging.public_plan.name', '企業・大規模自治体'),
                    'description' => __('regional_messaging.public_plan.description', '種の全リスト、CSV、証跡レポートなど、調査・報告に使う出力機能を提供する有料プランです。'),
                    'note' => __('regional_messaging.public_plan.note', 'Publicの収益で、無料提供と無償自治体支援を継続します。'),
                ],
                'support_policies' => [
                    [
                        'title' => __('regional_messaging.support_policies.0.title', '消滅可能性自治体には無償で届ける'),
                        'body' => __('regional_messaging.support_policies.0.body', '若年女性減少率80%以上を目安に、最も記録基盤が必要な地域には Public 相当の出力機能まで含めて無償提供します。'),
                    ],
                    [
                        'title' => __('regional_messaging.support_policies.1.title', '有料は Public だけに絞る'),
                        'body' => __('regional_messaging.support_policies.1.body', '企業や大規模自治体が必要とする出力・継続運用支援だけを有料にし、個人参加や地域の立ち上げには課金しません。'),
                    ],
                    [
                        'title' => __('regional_messaging.support_policies.2.title', 'ひとりで運営しても継続できる形にする'),
                        'body' => __('regional_messaging.support_policies.2.body', 'IKIMON株式会社は小さな会社だからこそ、Public 収益をそのまま無料提供へ回すシンプルな運営モデルにしています。'),
                    ],
                ],
            ];
        }

        return [
            'about_meta_description' => '自然観察を通じた地域創生。消滅可能性自治体への無償提供、原体験から生まれたビジョン。ikimon.lifeが目指す未来。',
            'business_meta_description' => '学校・地域団体は無料で運営開始。消滅可能性自治体には出力を含めて無償提供。企業・大規模自治体はPublicで継続運用を支えます。',
            'disappearing_section_heading' => '744の自治体が、消えるかもしれない',
            'disappearing_population_copy' => '2050年までに、20〜39歳の女性人口が50%以上減少すると推計される自治体——',
            'disappearing_count_copy' => 'いわゆる「消滅可能性自治体」が、全国で744。',
            'disappearing_ratio_copy' => '全自治体の、43%にあたります。',
            'priority_lead' => '最も危機的な自治体に、ikimon.lifeを届けたい。',
            'eligibility_copy' => '若年女性人口の減少率が80%を超える自治体——',
            'support_model_summary' => '企業や大規模自治体向けのPublicプランの収益で、この無償提供を支えます。',
            'free_plan' => [
                'tag' => '無償提供',
                'name' => '消滅可能性自治体（若年女性減少率80%以上）',
                'description' => 'プラットフォームのすべての機能を、完全無料で提供します。レポート出力・データエクスポートを含みます。',
            ],
            'community_plan' => [
                'tag' => 'Community',
                'name' => '一般市民・小規模団体',
                'description' => '観察の投稿・同定・図鑑・観察会への参加まで無料。誰でもすぐに始められます。',
            ],
            'public_plan' => [
                'tag' => 'Public',
                'name' => '企業・大規模自治体',
                'description' => '種の全リスト、CSV、証跡レポートなど、調査・報告に使う出力機能を提供する有料プランです。',
                'note' => 'Publicの収益で、無料提供と無償自治体支援を継続します。',
            ],
            'support_policies' => [
                [
                    'title' => '消滅可能性自治体には無償で届ける',
                    'body' => '若年女性減少率80%以上を目安に、最も記録基盤が必要な地域には Public 相当の出力機能まで含めて無償提供します。',
                ],
                [
                    'title' => '有料は Public だけに絞る',
                    'body' => '企業や大規模自治体が必要とする出力・継続運用支援だけを有料にし、個人参加や地域の立ち上げには課金しません。',
                ],
                [
                    'title' => 'ひとりで運営しても継続できる形にする',
                    'body' => 'IKIMON株式会社は小さな会社だからこそ、Public 収益をそのまま無料提供へ回すシンプルな運営モデルにしています。',
                ],
            ],
        ];
    }
}
