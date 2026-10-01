import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Gio from 'gi://Gio';
import { isInQuietHours } from '../utils/time.js';

export class Alerts {
    constructor(settings) {
        this._settings = settings;
        this._enabled = true;
        this._cooldowns = {};
        this._lastAlertTime = {};
    }

    setEnabled(enabled) {
        this._enabled = enabled;
    }

    evaluate(interfaceData, historyTotals) {
        if (!this._enabled) return [];

        const alerts = [];
        const now = Date.now();

        const quietHoursEnabled = this._settings.get_boolean('quiet-hours-enabled');
        const quietStart = this._settings.get_string('quiet-hours-start');
        const quietEnd = this._settings.get_string('quiet-hours-end');
        const cooldownSec = this._settings.get_int('notification-cooldown-sec');

        if (quietHoursEnabled && isInQuietHours(quietStart, quietEnd)) {
            return [];
        }

        const dailyCap = parseInt(this._settings.get_uint64('daily-cap-bytes'), 10);
        if (dailyCap > 0 && historyTotals?.today) {
            const todayRx = historyTotals.today.rxBytes || 0;
            const todayTx = historyTotals.today.txBytes || 0;
            const totalToday = todayRx + todayTx;
            const pct = (totalToday / dailyCap) * 100;

            if (pct >= 100) {
                alerts.push(this._makeAlert('daily-cap-reached', 'critical',
                    `Daily data cap reached: ${(totalToday / 1e9).toFixed(2)} GB used`));
            } else if (pct >= 90) {
                alerts.push(this._makeAlert('daily-cap-warning', 'warning',
                    `Daily data cap at ${pct.toFixed(0)}%: ${(totalToday / 1e9).toFixed(2)} GB used`));
            }
        }

        const monthlyCap = parseInt(this._settings.get_uint64('monthly-cap-bytes'), 10);
        if (monthlyCap > 0 && historyTotals?.month) {
            const monthRx = historyTotals.month.rxBytes || 0;
            const monthTx = historyTotals.month.txBytes || 0;
            const totalMonth = monthRx + monthTx;
            const pct = (totalMonth / monthlyCap) * 100;

            if (pct >= 100) {
                alerts.push(this._makeAlert('monthly-cap-reached', 'critical',
                    `Monthly data cap reached: ${(totalMonth / 1e9).toFixed(2)} GB used`));
            } else if (pct >= 90) {
                alerts.push(this._makeAlert('monthly-cap-warning', 'warning',
                    `Monthly data cap at ${pct.toFixed(0)}%: ${(totalMonth / 1e9).toFixed(2)} GB used`));
            }
        }

        const spikeThreshold = parseInt(this._settings.get_uint64('spike-threshold-bytes-per-sec'), 10);
        if (spikeThreshold > 0 && interfaceData) {
            const totalRate = (interfaceData.totalRxRate || 0) + (interfaceData.totalTxRate || 0);
            if (totalRate > spikeThreshold) {
                const key = 'spike';
                if (!this._isInCooldown(key, cooldownSec)) {
                    alerts.push(this._makeAlert('spike-detected', 'info',
                        `Traffic spike: ${(totalRate / 1e6).toFixed(1)} MB/s`));
                    this._setCooldown(key, now);
                }
            }
        }

        return alerts;
    }

    _makeAlert(type, severity, message) {
        return {
            type,
            severity,
            message,
            timestamp: Date.now()
        };
    }

    _isInCooldown(key, cooldownSec) {
        const last = this._lastAlertTime[key];
        if (!last) return false;
        return (Date.now() - last) < (cooldownSec * 1000);
    }

    _setCooldown(key, time) {
        this._lastAlertTime[key] = time;
    }

    sendNotification(alert) {
        if (!Main?.notify) return;

        const urgency = alert.severity === 'critical'
            ? Gio.NotificationPriority.CRITICAL
            : alert.severity === 'warning'
                ? Gio.NotificationPriority.HIGH
                : Gio.NotificationPriority.NORMAL;

        const notification = new Gio.Notification();
        notification.set_title('Net Monitor');
        notification.set_body(alert.message);
        notification.set_priority(urgency);
        notification.set_icon(Gio.ThemedIcon.new('network-transmit-receive-symbolic'));

        Main.notify(notification);
    }

    showAlert(alert) {
        const cooldownSec = this._settings.get_int('notification-cooldown-sec');
        const key = alert.type;
        const now = Date.now();

        if (this._isInCooldown(key, cooldownSec)) return;

        this.sendNotification(alert);
        this._setCooldown(key, now);
    }

    resetCooldowns() {
        this._lastAlertTime = {};
    }

    destroy() {
        this._cooldowns = {};
        this._lastAlertTime = {};
    }
}
