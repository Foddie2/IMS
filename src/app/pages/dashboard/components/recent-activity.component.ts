import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { ActivityEvent, ActivityType } from '../../../core/models/inventory.models';
import { IconComponent, IconName } from '../../../shared/components/icon.component';
import { PanelComponent } from '../../../shared/components/panel.component';

const ACTIVITY_STYLES: Record<ActivityType, { icon: IconName; tone: string; label: string }> = {
  received: { icon: 'received', tone: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/10', label: 'Received' },
  shipped: { icon: 'truck', tone: 'bg-green-50 text-good-ink ring-green-100 dark:bg-green-500/15 dark:ring-green-500/10', label: 'Shipped' },
  adjusted: { icon: 'adjusted', tone: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/10', label: 'Adjusted' },
  transfer: { icon: 'shipped', tone: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/10', label: 'Transfer' },
  alert: { icon: 'alert', tone: 'bg-red-50 text-bad-ink ring-red-100 dark:bg-red-500/15 dark:ring-red-500/10', label: 'Alert' },
  order: { icon: 'order', tone: 'bg-amber-50 text-warn-ink ring-amber-100 dark:bg-amber-500/15 dark:ring-amber-500/10', label: 'Order' },
};

@Component({
  selector: 'app-recent-activity',
  imports: [DatePipe, IconComponent, PanelComponent],
  template: `
    <app-panel heading="Recent Activity" subheading="Latest stock movements">
      <ol class="relative">
        @for (event of events(); track event.id; let last = $last) {
          <li class="relative flex gap-3 pb-5 last:pb-0">
            @if (!last) {
              <span class="absolute top-9 bottom-0 left-[17px] w-px bg-line" aria-hidden="true"></span>
            }
            <span class="relative grid size-9 shrink-0 place-items-center rounded-full ring-4" [class]="styles[event.type].tone">
              <app-icon [name]="styles[event.type].icon" class="size-4" />
              <span class="sr-only">{{ styles[event.type].label }}:</span>
            </span>
            <div class="min-w-0 pt-0.5">
              <p class="text-sm font-medium text-ink">{{ event.title }}</p>
              <p class="truncate text-xs text-ink-muted">{{ event.detail }}</p>
              <p class="mt-0.5 text-xs text-ink-subtle">
                <time [attr.datetime]="event.timestamp">{{ event.timestamp | date: 'MMM d · h:mm a' }}</time>
              </p>
            </div>
          </li>
        } @empty {
          <li class="text-sm text-ink-subtle">No recent activity.</li>
        }
      </ol>
    </app-panel>
  `,
  host: { class: 'block' },
})
export class RecentActivityComponent {
  readonly events = input.required<readonly ActivityEvent[]>();
  protected readonly styles = ACTIVITY_STYLES;
}
