import { Banknote } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface PaymentMethodOption {
  id: string;
  label: string;
  type: string;
}

interface PayoutFormProps {
  balance?: number;
  methods?: PaymentMethodOption[];
  action: (formData: FormData) => void | Promise<void>;
  title?: string;
}

export function PayoutForm({ balance = 0, methods = [], action, title = 'طلب سحب جديد' }: PayoutFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Banknote className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!methods.length ? (
          <p className="text-sm text-muted-foreground">أضف وسيلة دفع من الإعدادات أولًا لتتمكن من السحب.</p>
        ) : (
          <form action={action} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground" htmlFor="payout-amount">
                المبلغ (EGP) — المتاح {balance.toLocaleString()}
              </label>
              <Input
                id="payout-amount"
                name="amount"
                type="number"
                min={1}
                max={balance}
                required
                placeholder="500"
                dir="ltr"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground" htmlFor="payout-method">
                وسيلة الدفع
              </label>
              <select id="payout-method" name="payment_method_id" required className="mt-1 h-10 w-full rounded-md border px-3 text-sm">
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.type})
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" className="w-full bg-slate-900 font-bold text-white hover:bg-slate-700">
              إرسال للمراجعة
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
