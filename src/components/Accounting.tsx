import React, { useState, useEffect } from 'react';
import { db } from '../lib/dexie';
import { queueOfflineWrite } from '../lib/sync';
import {
  DollarSign,
  TrendingUp,
  Percent,
  TrendingDown,
  Building
} from 'lucide-react';

export const Accounting: React.FC = () => {
  // Tabs
  const [activeSubTab, setActiveSubTab] = useState<'ledgers' | 'assets' | 'expenses' | 'liquidity'>('liquidity');

  // Master lists
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [fixedAssets, setFixedAssets] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [stockMovements, setStockMovements] = useState<any[]>([]);

  // 1. Asset state
  const [assetName, setAssetName] = useState('');
  const [assetValue, setAssetValue] = useState('0');
  const [assetDepr, setAssetDepr] = useState('0');

  // 2. Expense state
  const [expCategory, setExpCategory] = useState(''); // account_id of category expense
  const [expAmount, setExpAmount] = useState('0');
  const [expAccount, setExpAccountId] = useState(''); // Cash or Bank Account
  const [expNotes, setExpNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const listAccs = await db.accounts.toArray();
    const listTxs = await db.account_transactions.toArray();
    const listAssets = await db.fixed_assets.toArray();
    const listExps = await db.expenses.toArray();
    const listItems = await db.items.toArray();
    const listMovs = await db.stock_movements.toArray();

    setAccounts(listAccs);
    setTransactions(listTxs.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setFixedAssets(listAssets);
    setExpenses(listExps.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setItems(listItems);
    setStockMovements(listMovs);

    const expenseCategories = listAccs.filter((a: any) => a.category === 'expense');
    if (expenseCategories.length > 0) setExpCategory(expenseCategories[0].id);

    const cashBankAccs = listAccs.filter((a: any) => a.category === 'cash' || a.category === 'bank');
    if (cashBankAccs.length > 0) setExpAccountId(cashBankAccs[0].id);
  };

  // Add Fixed Asset
  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName.trim() || Number(assetValue) <= 0) return;

    try {
      const id = crypto.randomUUID();
      const val = Number(assetValue);
      const deprRate = Number(assetDepr);

      const assetObj = {
        id,
        name: assetName.trim(),
        value: val,
        depreciation_rate: deprRate,
        purchase_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      };
      await queueOfflineWrite('fixed_assets', 'insert', id, assetObj);

      // Debit Fixed Assets account, Credit Capital/Cash (we will debit assets account)
      const assetAcc = accounts.find((a: any) => a.category === 'fixed_assets')?.id;
      const capitalAcc = accounts.find((a: any) => a.category === 'capital')?.id;
      if (assetAcc && capitalAcc) {
        const tx1 = crypto.randomUUID();
        await queueOfflineWrite('account_transactions', 'insert', tx1, {
          id: tx1,
          account_id: assetAcc,
          ref_table: 'fixed_assets',
          ref_id: id,
          debit: val,
          credit: 0,
          date: new Date().toISOString().split('T')[0]
        });
        const tx2 = crypto.randomUUID();
        await queueOfflineWrite('account_transactions', 'insert', tx2, {
          id: tx2,
          account_id: capitalAcc,
          ref_table: 'fixed_assets',
          ref_id: id,
          debit: 0,
          credit: val,
          date: new Date().toISOString().split('T')[0]
        });
      }

      setAssetName('');
      setAssetValue('0');
      setAssetDepr('0');
      await loadData();
      alert('تم تسجيل الأصل الثابت بنجاح وتوليد القيود المحاسبية له!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Add Expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(expAmount) <= 0 || !expCategory || !expAccount) return;

    try {
      const id = crypto.randomUUID();
      const amountNum = Number(expAmount);

      const expObj = {
        id,
        category_id: expCategory,
        amount: amountNum,
        date: new Date().toISOString().split('T')[0],
        account_id: expAccount,
        notes: expNotes.trim() || null,
        created_at: new Date().toISOString()
      };
      await queueOfflineWrite('expenses', 'insert', id, expObj);

      // Debit Expense account, Credit Cash/Bank account
      const tx1 = crypto.randomUUID();
      await queueOfflineWrite('account_transactions', 'insert', tx1, {
        id: tx1,
        account_id: expCategory,
        ref_table: 'expenses',
        ref_id: id,
        debit: amountNum,
        credit: 0,
        date: new Date().toISOString().split('T')[0]
      });
      const tx2 = crypto.randomUUID();
      await queueOfflineWrite('account_transactions', 'insert', tx2, {
        id: tx2,
        account_id: expAccount,
        ref_table: 'expenses',
        ref_id: id,
        debit: 0,
        credit: amountNum,
        date: new Date().toISOString().split('T')[0]
      });

      setExpAmount('0');
      setExpNotes('');
      await loadData();
      alert('تم تسجيل مصروف التشغيل وصرف القيد المالي المحاسبي له بنجاح!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Live Capital & Liquidity calculations
  // Cash + Bank + AR - AP + Inventory value
  const calculateAccountBalance = (accId: string) => {
    return transactions
      .filter((tx: any) => tx.account_id === accId)
      .reduce((sum, tx) => sum + Number(tx.debit) - Number(tx.credit), 0);
  };

  const getCashBalance = () => {
    const cashAccs = accounts.filter((a: any) => a.category === 'cash');
    return cashAccs.reduce((sum, a) => sum + calculateAccountBalance(a.id), 0);
  };

  const getBankBalance = () => {
    const bankAccs = accounts.filter((a: any) => a.category === 'bank');
    return bankAccs.reduce((sum, a) => sum + calculateAccountBalance(a.id), 0);
  };

  const getARBalance = () => {
    const arAccs = accounts.filter((a: any) => a.category === 'ar');
    return arAccs.reduce((sum, a) => sum + calculateAccountBalance(a.id), 0);
  };

  const getAPBalance = () => {
    const apAccs = accounts.filter((a: any) => a.category === 'ap');
    // AP balance is credit - debit
    return apAccs.reduce((sum, a) => {
      const balance = transactions
        .filter((tx: any) => tx.account_id === a.id)
        .reduce((s, tx) => s + Number(tx.credit) - Number(tx.debit), 0);
      return sum + balance;
    }, 0);
  };

  const calculateInventoryValuation = () => {
    return items.reduce((sum, item) => {
      const stock = stockMovements
        .filter((m: any) => m.item_id === item.id)
        .reduce((s, m) => s + Number(m.qty), 0);
      const cost = Number(item.default_price) * 0.6; // estimate cost at 60% of retail
      return sum + (stock * cost);
    }, 0);
  };

  const cash = getCashBalance();
  const bank = getBankBalance();
  const ar = getARBalance();
  const ap = getAPBalance();
  const invVal = calculateInventoryValuation();
  const fixed = fixedAssets.reduce((sum, a) => sum + Number(a.value), 0);

  const totalCapital = cash + bank + ar + invVal + fixed - ap;

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">شجرة الحسابات والمالية / Accounting</h1>
        <p className="text-gray-500 text-sm mt-1">تتبع التدفق المالي الجاري، حساب رأس المال والسيولة المتاحة والأصول الثابتة والمصروفات</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 bg-white rounded-lg p-1 shadow-sm">
        <button
          onClick={() => setActiveSubTab('liquidity')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'liquidity' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>مؤشرات رأس المال الفعلي والسيولة</span>
        </button>
        <button
          onClick={() => setActiveSubTab('expenses')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'expenses' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <TrendingDown className="h-4 w-4" />
          <span>تسجيل ومراقبة مصروفات التشغيل</span>
        </button>
        <button
          onClick={() => setActiveSubTab('assets')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'assets' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Building className="h-4 w-4" />
          <span>سجل الأصول الثابتة والاملاك</span>
        </button>
        <button
          onClick={() => setActiveSubTab('ledgers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'ledgers' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          <span>قيود دفتر اليومية التفصيلية</span>
        </button>
      </div>

      {activeSubTab === 'liquidity' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg border shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-green-600">رأس المال الفعلي الجاري (Liquidity)</span>
                <div className="text-3xl font-black mt-2 text-gray-900">{totalCapital.toFixed(2)} ر.س</div>
              </div>
              <div className="text-[10px] text-gray-400 mt-4">
                الحسبة: صندوق الكاش + البنوك + مستحقات العملاء + قيمة البضاعة التامة والخامات - مستحقات الموردين + الاصول الثابتة
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-blue-600">السيولة النقدية المتاحة (Cash & Bank)</span>
                <div className="text-3xl font-black mt-2 text-gray-900">{(cash + bank).toFixed(2)} ر.س</div>
              </div>
              <div className="flex gap-4 mt-4 text-[10px] text-gray-500">
                <span>الكاش: {cash.toFixed(2)} ر.س</span>
                <span>البنك: {bank.toFixed(2)} ر.س</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-yellow-600">الذمم المالية والمديونيات الخارجية</span>
                <div className="text-3xl font-black mt-2 text-gray-900">{(ar - ap).toFixed(2)} ر.س</div>
              </div>
              <div className="flex gap-4 mt-4 text-[10px] text-gray-500">
                <span className="text-green-600">مستحقات لنا: {ar.toFixed(2)} ر.س</span>
                <span className="text-red-600">مستحقات للموردين: {ap.toFixed(2)} ر.s</span>
              </div>
            </div>
          </div>

          {/* Quick Charts */}
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">تفاصيل وهيكل الميزانية المادية</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-3">
                <div className="flex justify-between border-b pb-1">
                  <span className="text-gray-600">قيمة مخزون المستودعات (تقديرية):</span>
                  <span className="font-mono font-bold text-gray-900">{invVal.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span className="text-gray-600">قيمة الأصول الثابتة والأجهزة:</span>
                  <span className="font-mono font-bold text-gray-900">{fixed.toFixed(2)} ر.s</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span className="text-gray-600">إجمالي الموجودات (الأصول والسيولة):</span>
                  <span className="font-mono font-bold text-green-600">{(cash + bank + ar + invVal + fixed).toFixed(2)} ر.س</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between border-b pb-1">
                  <span className="text-gray-600">إجمالي الالتزامات والخصوم (الموردون):</span>
                  <span className="font-mono font-bold text-red-600">{ap.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span className="text-gray-600">رأس المال الفعلي (Net Assets):</span>
                  <span className="font-mono font-bold text-blue-600">{totalCapital.toFixed(2)} ر.س</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'expenses' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add expense form */}
          <div className="bg-white p-5 rounded-lg border shadow h-fit">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">تسجيل مصروف تشغيل جديد</h3>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">بند المصروف (فئة الحساب)</label>
                <select
                  required
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white font-semibold"
                >
                  {accounts.filter((a: any) => a.category === 'expense').map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">طريقة الصرف (صندوق الكاش أو البنك)</label>
                <select
                  required
                  value={expAccount}
                  onChange={(e) => setExpAccountId(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                >
                  {accounts.filter((a: any) => a.category === 'cash' || a.category === 'bank').map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">المبلغ المالي (ر.س)</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.01"
                  required
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">ملاحظات / تفاصيل الفاتورة</label>
                <textarea
                  placeholder="مثال: فاتورة كهرباء شهر يوليو لمصنع لواصق الإطارات"
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm h-20"
                />
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-xs transition"
              >
                تسجيل وصرف المبلغ
              </button>
            </form>
          </div>

          {/* Expenses log list */}
          <div className="lg:col-span-2 bg-white p-5 rounded-lg border shadow">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">سجل المصروفات التشغيلية الأخير</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-right">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-bold text-gray-500">
                    <th className="py-3 px-4">الفئة</th>
                    <th className="py-3 px-4">المبلغ</th>
                    <th className="py-3 px-4">حساب الصرف</th>
                    <th className="py-3 px-4">ملاحظات</th>
                    <th className="py-3 px-4">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {expenses.map(e => {
                    const catName = accounts.find(a => a.id === e.category_id)?.name || '';
                    const accName = accounts.find(a => a.id === e.account_id)?.name || '';
                    return (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-semibold text-gray-800">{catName}</td>
                        <td className="py-3 px-4 font-mono font-bold text-red-600">{e.amount} ر.س</td>
                        <td className="py-3 px-4 text-gray-600">{accName}</td>
                        <td className="py-3 px-4 text-gray-600 text-xs">{e.notes || '-'}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs">{new Date(e.date).toLocaleDateString('ar-EG')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'assets' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Asset Form */}
          <div className="bg-white p-5 rounded-lg border shadow h-fit">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">تسجيل أصل ثابت جديد (آلات، معدات)</h3>
            <form onSubmit={handleAddAsset} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">اسم الأصل</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: آلة كبس وتعبئة سعة 600 مل"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">القيمة المادية التقديرية للأصل (ر.س)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={assetValue}
                  onChange={(e) => setAssetValue(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">نسبة الإهلاك السنوي المتوقعة %</label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Percent className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={assetDepr}
                    onChange={(e) => setAssetDepr(e.target.value)}
                    className="block w-full pr-10 border border-gray-300 rounded py-1.5 px-3 text-sm text-left"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs transition"
              >
                تسجيل الأصل وتوليد القيد
              </button>
            </form>
          </div>

          {/* Asset register table list */}
          <div className="lg:col-span-2 bg-white p-5 rounded-lg border shadow">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">دفتر سجل الأصول والاملاك الثابتة</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-right">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-bold text-gray-500">
                    <th className="py-3 px-4">اسم الأصل الثابت</th>
                    <th className="py-3 px-4">القيمة الشرائية</th>
                    <th className="py-3 px-4">نسبة الإهلاك</th>
                    <th className="py-3 px-4">تاريخ الشراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {fixedAssets.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-bold text-gray-800">{a.name}</td>
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">{a.value} ر.س</td>
                      <td className="py-3 px-4 text-gray-600">{a.depreciation_rate}% سنوياً</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{new Date(a.purchase_date).toLocaleDateString('ar-EG')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'ledgers' && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">تفاصيل قيود اليومية العامة والدفاتر الحسابية</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-right">
              <thead className="bg-gray-50">
                <tr className="text-xs font-bold text-gray-500">
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">الحساب</th>
                  <th className="py-3 px-4 text-center text-green-600">مدين (Debit +)</th>
                  <th className="py-3 px-4 text-center text-red-600">دائن (Credit -)</th>
                  <th className="py-3 px-4 text-xs">نوع المستند المرجعي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {transactions.map((tx, idx) => {
                  const accName = accounts.find(a => a.id === tx.account_id)?.name || '';
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-500 text-xs">{new Date(tx.date).toLocaleDateString('ar-EG')}</td>
                      <td className="py-3 px-4 font-semibold text-gray-800">{accName}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-green-600">{Number(tx.debit) > 0 ? `+${tx.debit}` : '-'}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-red-600">{Number(tx.credit) > 0 ? `-${tx.credit}` : '-'}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs font-mono">{tx.ref_table || 'تسوية محاسبية'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
