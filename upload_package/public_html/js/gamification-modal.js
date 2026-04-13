document.addEventListener('alpine:init', () => {
    Alpine.data('gamificationModal', () => ({
        show: false,
        events: [],
        currentIndex: 0,
        currentEvent: null,

        init() {
            window.addEventListener('gamification-event', (e) => {
                this.events = e.detail;
                if (this.events.length > 0) {
                    this.currentIndex = 0;
                    this.currentEvent = this.events[0];
                    this.show = true;
                    // Play sound (optional)
                    // this.playSound();
                }
            });
        },

        next() {
            if (this.currentIndex < this.events.length - 1) {
                this.currentIndex++;
                this.currentEvent = this.events[this.currentIndex];
                // Play sound for next item
            } else {
                this.close();
            }
        },

        close() {
            this.show = false;
            setTimeout(() => {
                this.events = [];
                this.currentEvent = null;
            }, 300);
        },

        get title() {
            if (!this.currentEvent) return '';
            switch (this.currentEvent.type) {
                case 'rank_up': return 'RANK UP!';
                case 'badge_earned': return 'BADGE EARNED!';
                case 'quest_complete': return 'QUEST COMPLETE!';
                default: return 'LEVEL UP!';
            }
        },

        get message() {
            if (!this.currentEvent) return '';
            switch (this.currentEvent.type) {
                case 'rank_up':
                    return `「${this.currentEvent.rank.name_ja}」に昇格しました！`;
                case 'badge_earned':
                    return `「${this.currentEvent.badge.name}」を獲得しました！`;
                case 'quest_complete':
                    return `「${this.currentEvent.quest.title}」を達成！ (+${this.currentEvent.reward}pt)`;
                default: return '';
            }
        },

        get icon() {
            if (!this.currentEvent) return '';
            // Return appropriate lucide icon name or image URL
            switch (this.currentEvent.type) {
                case 'rank_up': return 'crown';
                case 'badge_earned': return 'award';
                case 'quest_complete': return 'check-circle-2';
                default: return 'star';
            }
        },

        get colorClass() {
            if (!this.currentEvent) return 'text-primary';
            switch (this.currentEvent.type) {
                case 'rank_up': return 'text-warning';
                case 'badge_earned': return 'text-accent';
                case 'quest_complete': return 'text-success';
                default: return 'text-primary';
            }
        }
    }));
});
