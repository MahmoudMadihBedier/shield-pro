import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Copy, Check } from 'lucide-react';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { useAuth } from '../../application/services/auth-service';
import { useCustomers, useSalesInvoices, useReceiptVouchers } from '../../application/hooks/use-sales';
import { useToast } from './ui/Toast';
import { useConfirm } from './ui/ConfirmDialog';
import { DocList, type DocColumn } from './ui/DocList';
import { DocForm } from './ui/DocForm';
import { StatusBadge } from './ui/StatusBadge';
import { EntitySelect, type EntityOption } from './ui/EntitySelect';
import { MoneyInput } from './ui/NumberInput';
import { FormField } from './ui/ValidationMessage';
import { getErrorMessage } from '../../shared/utils/errors';
import { formatCurrency, formatDate } from '../../shared/utils/format';
import type { PaginationParams } from '../../core/types';

const UNPAGINATED: PaginationParams = { page: 1, limit: 100000 };

// The Sales "Customer" document, rebuilt in the ERPNext List → Form shape as
// the template for every other module. All behaviour (client code, portal
// PIN, branch approval, WhatsApp share, running balance) is preserved.
export const SalesCustomers: React.FC = () => {
  const { profile, checkPermission } = useAuth();
  const isAdmin = profile?.role_name === 'Master Admin' || checkPermission('settings', 'edit');
  const { success, error } = useToast();
  const confirm = useConfirm();

  const { customers: customersResult, createCustomer, approveCustomer, setCustomerPortalPin } = useCustomers();
  const customers = customersResult.data;
  const { invoices: invResult } = useSalesInvoices(undefined, UNPAGINATED);
  const { vouchers: vouResult } = useReceiptVouchers(undefined, UNPAGINATED);
  const invoices = invResult.data;
  const vouchers = vouResult.data;

  const [warehouses, setWarehouses] = useState<any[]>([]);
  useEffect(() => { RepositoryFactory.getWarehouseRepository().findActive().then(setWarehouses); }, []);

  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // new-customer form
  const [f, setF] = useState({ name: '', phone: '', email: '', address: '', opening: '' as number | '' });
  // open-customer actions
  const [branchId, setBranchId] = useState('');
  const [pin, setPin] = useState('');

  const whName = (id?: string | null) => warehouses.find((w) => w.id === id)?.name || '—';
  const runningBalance = (id: string) =>
    Number(customers.find((c) => c.id === id)?.opening_balance || 0)
    + invoices.filter((i) => i.customer_id === id).reduce((s, i) => s + Number(i.total), 0)
    - vouchers.filter((v) => v.customer_id === id).reduce((s, v) => s + Number(v.amount), 0);

  const branchOptions: EntityOption[] = useMemo(
    () => warehouses.map((w) => ({ value: w.id, label: w.name })),
    [warehouses],
  );

  const shareOnWhatsApp = (clientId: string, name: string) => {
    const msg = `أهلاً ${name}،\n\nده كود دخولك على بوابة العملاء: ${clientId}\n\nتقدر تدخل من هنا: ${window.location.origin}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const doCreate = async () => {
    if (!f.name.trim()) { error('اكتب اسم العميل'); return; }
    setBusy(true);
    try {
      const c = await createCustomer({
        name: f.name.trim(),
        email: f.email.trim() || undefined,
        phone: f.phone.trim() || undefined,
        address: f.address.trim() || undefined,
        opening_balance: Number(f.opening || 0),
        approval_status: isAdmin ? 'approved' : 'pending',
      } as any);
      success('اتسجّل العميل');
      setF({ name: '', phone: '', email: '', address: '', opening: '' });
      setCreating(false);
      if (c?.id) setOpenId(c.id);
    } catch (e) { error(getErrorMessage(e, 'تعذّر تسجيل العميل')); }
    finally { setBusy(false); }
  };

  const doApprove = async (id: string) => {
    const wh = branchId || warehouses[0]?.id;
    if (!wh) { error('لازم تضيف فرع الأول من شاشة المخزون'); return; }
    setBusy(true);
    try {
      await approveCustomer(id, wh);
      success('اتعتمد العميل واتحدد فرعه');
    } catch (e) { error(getErrorMessage(e, 'تعذّر اعتماد العميل')); }
    finally { setBusy(false); }
  };

  const doSetPin = async (id: string) => {
    if (!/^\d{4,6}$/.test(pin)) { error('الرقم السري لازم يكون من 4 لـ 6 أرقام'); return; }
    if (!(await confirm({ title: 'تعيين رقم سري لبوابة العميل؟', message: 'العميل هيستخدمه مع كود العميل علشان يدخل البوابة.', confirmText: 'تعيين' }))) return;
    setBusy(true);
    try {
      await setCustomerPortalPin(id, pin);
      success('اتعيّن الرقم السري');
      setPin('');
    } catch (e) { error(getErrorMessage(e, 'تعذّر تعيين الرقم السري')); }
    finally { setBusy(false); }
  };

  // ---- LIST ------------------------------------------------------------
  const columns: DocColumn<any>[] = [
    { key: 'name', label: 'الاسم', primary: true },
    { key: 'phone', label: 'الهاتف', render: (c) => c.phone || '—' },
    { key: 'address', label: 'العنوان', hideOnCard: true, render: (c) => c.address || '—' },
    { key: 'balance', label: 'الرصيد الجاري', render: (c) => <span className="font-mono text-blue-700">{formatCurrency(runningBalance(c.id))}</span> },
    {
      key: 'status', label: 'الفرع / الحالة', render: (c) =>
        c.approval_status === 'pending'
          ? <StatusBadge group="approvalStatus" value="pending" />
          : <span className="text-xs text-gray-600">{whName(c.warehouse_id)}</span>,
    },
  ];

  if (!openId && !creating) {
    return (
      <DocList
        rows={customers}
        columns={columns}
        getId={(c) => c.id}
        onOpen={(c) => { setBranchId(c.warehouse_id || ''); setPin(''); setOpenId(c.id); }}
        onNew={() => setCreating(true)}
        newLabel="عميل جديد"
        emptyTitle="لسه مفيش عملاء"
        emptyHint="اضغط «عميل جديد» علشان تضيف أول عميل."
        search={(c, q) => (c.name + ' ' + (c.phone || '')).toLowerCase().includes(q.toLowerCase())}
      />
    );
  }

  // ---- NEW FORM ------------------------------------------------------------
  if (creating) {
    return (
      <DocForm
        title="عميل جديد"
        actions={
          <>
            <button onClick={() => setCreating(false)} className="text-sm font-semibold px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100">رجوع</button>
            <button onClick={doCreate} disabled={busy} className="text-sm font-bold px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">حفظ العميل</button>
          </>
        }
      >
        <DocForm.Section title="بيانات العميل">
          <FormField label="اسم العميل / الشركة" required>
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="مثال: سوبر ماركت الأمانة" className="w-full border rounded-lg py-2 px-3 text-sm" />
          </FormField>
          <FormField label="رقم الهاتف">
            <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="01xxxxxxxxx" className="w-full border rounded-lg py-2 px-3 text-sm text-left" dir="ltr" />
          </FormField>
          <FormField label="البريد الإلكتروني" helpText="للتواصل فقط">
            <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="w-full border rounded-lg py-2 px-3 text-sm text-left" dir="ltr" />
          </FormField>
          <FormField label="العنوان">
            <input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} className="w-full border rounded-lg py-2 px-3 text-sm" />
          </FormField>
          <FormField label="رصيد أول المدة" helpText="لو العميل عليه فلوس من قبل ما تسجّله في النظام">
            <MoneyInput value={f.opening} onChange={(v) => setF({ ...f, opening: v })} />
          </FormField>
        </DocForm.Section>
      </DocForm>
    );
  }

  // ---- OPEN CUSTOMER ------------------------------------------------------------
  const c = customers.find((x) => x.id === openId);
  if (!c) { setOpenId(null); return null; }
  const pending = c.approval_status === 'pending';

  return (
    <DocForm
      title={c.name}
      status={pending ? { group: 'approvalStatus', value: 'pending' } : undefined}
      meta={[
        { label: 'كود العميل', value: c.client_id
          ? <span className="inline-flex items-center gap-1">
              <span className="font-mono">{c.client_id}</span>
              <button onClick={() => { navigator.clipboard.writeText(c.client_id!); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-gray-400 hover:text-gray-600">
                {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
              </button>
            </span>
          : '—' },
        { label: 'الفرع', value: whName(c.warehouse_id) },
        { label: 'الرصيد الجاري', value: formatCurrency(runningBalance(c.id)) },
        { label: 'الرقم السري', value: c.portal_pin_hash ? 'متعيّن' : 'مش متعيّن' },
        { label: 'اتسجّل', value: c.created_at ? formatDate(c.created_at) : '—' },
      ]}
      actions={
        <>
          <button onClick={() => setOpenId(null)} className="text-sm font-semibold px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100">رجوع للقائمة</button>
          {c.client_id && (
            <button onClick={() => shareOnWhatsApp(c.client_id!, c.name)} className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700">
              <MessageCircle className="h-4 w-4" /> مشاركة الكود
            </button>
          )}
          {pending && isAdmin && (
            <>
              <div className="w-40"><EntitySelect options={branchOptions} value={branchId} onChange={setBranchId} placeholder="اختر الفرع" /></div>
              <button onClick={() => doApprove(c.id)} disabled={busy} className="text-sm font-bold px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">اعتماد العميل</button>
            </>
          )}
        </>
      }
    >
      <DocForm.Section title="بيانات العميل">
        <FormField label="الهاتف"><div className="text-sm text-gray-800 py-2" dir="ltr">{c.phone || '—'}</div></FormField>
        <FormField label="العنوان"><div className="text-sm text-gray-800 py-2">{c.address || '—'}</div></FormField>
        <FormField label="البريد"><div className="text-sm text-gray-800 py-2" dir="ltr">{c.email || '—'}</div></FormField>
        <FormField label="حد الائتمان"><div className="text-sm text-gray-800 py-2">{c.credit_limit != null ? formatCurrency(Number(c.credit_limit)) : 'غير محدد'}</div></FormField>
      </DocForm.Section>

      <DocForm.Section title="رقم سري لبوابة العميل">
        <div className="sm:col-span-2 flex flex-wrap items-end gap-2">
          <FormField label={c.portal_pin_hash ? 'تغيير الرقم السري' : 'تعيين رقم سري'}>
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} maxLength={6} placeholder="4 لـ 6 أرقام" className="w-32 border rounded-lg py-2 px-3 text-sm" dir="ltr" />
          </FormField>
          <button onClick={() => doSetPin(c.id)} disabled={busy || !pin} className="text-sm font-bold px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">حفظ الرقم السري</button>
        </div>
      </DocForm.Section>
    </DocForm>
  );
};
