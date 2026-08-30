// Single source of truth for turning database enum values and formal
// bookkeeping terms into the plain everyday Egyptian Arabic the app should
// show. ERPNext keeps every screen consistent by never leaking a raw field
// value to the user — same idea here.
//
// - enumLabel(group, value): DB enum -> Arabic label (falls back to the raw
//   value so a new/unknown value degrades instead of crashing).
// - badgeTone(group, value): which colour a StatusBadge should use.
// - term(key): plain-Egyptian replacement for a formal term.

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

type LabelMap = Record<string, string>;

const ENUM_LABELS: Record<string, LabelMap> = {
  docStatus: {
    draft: 'مسودة',
    submitted: 'معتمد',
    cancelled: 'ملغي',
  },
  itemType: {
    raw_material: 'مادة خام',
    packaging: 'مواد تعبئة وتغليف',
    intermediate: 'منتج وسيط',
    finished_good: 'منتج تام',
    consumable: 'مستهلكات',
  },
  warehouseKind: {
    raw_materials: 'مخزن الخامات',
    factory: 'مخزن المصنع',
    general: 'عام',
  },
  warehouseType: {
    main: 'المخزن الرئيسي',
    branch: 'فرع',
  },
  movementType: {
    purchase_in: 'استلام مشتريات',
    sale_out: 'صرف بيع',
    production_consumption: 'صرف خامات للتصنيع',
    production_output: 'إنتاج تام',
    sales_return_in: 'مرتجع بيع وارد',
    purchase_return_out: 'مرتجع مشتريات صادر',
    manual_adjustment: 'تعديل يدوي',
    transfer_out: 'تحويل صادر',
    transfer_in: 'تحويل وارد',
    rep_issue: 'صرف عهدة لمندوب',
    rep_return: 'إرجاع عهدة من مندوب',
  },
  productionRequestStatus: {
    pending_materials: 'بانتظار صرف الخامات',
    materials_approved: 'اتصرفت الخامات',
    rejected: 'مرفوض',
    in_production: 'تحت التصنيع',
    completed: 'خلص',
  },
  batchStatus: {
    draft: 'بانتظار تسجيل الإنتاج',
    confirmed: 'مؤكدة',
    pending_qc: 'بانتظار فحص الجودة',
    released: 'اعتمدتها الجودة',
    rejected: 'رفضتها الجودة',
    completed: 'مكتملة (سجل قديم)',
  },
  distributionStatus: {
    pending_approval: 'بانتظار الموافقة',
    approved: 'اتوافق — بانتظار الشحن',
    rejected: 'مرفوض',
    in_transit: 'في الطريق',
    received_matched: 'اتستلم مطابق',
    received_discrepancy: 'فيه فرق — بانتظار الحل',
    discrepancy_resolved: 'اتحل الفرق',
  },
  repStockRequestStatus: {
    pending_approval: 'بانتظار الموافقة',
    approved: 'اتوافق',
    issued: 'اتحوّل للعهدة',
    rejected: 'مرفوض',
  },
  closeoutStatus: {
    open: 'مفتوح',
    submitted: 'اترفع',
    confirmed: 'اتعتمد',
    variance_flagged: 'فيه فرق',
  },
  settlementStatus: {
    draft: 'مسودة',
    submitted: 'بانتظار الاعتماد',
    confirmed: 'اتعتمد واتسجّل',
  },
  invoiceStatus: {
    unpaid: 'مفتوحة',
    partially_paid: 'مدفوعة جزئي',
    paid: 'مدفوعة',
    cancelled: 'ملغية',
  },
  paymentMethod: {
    cash: 'كاش',
    credit: 'على الحساب',
    bank: 'تحويل بنكي',
  },
  approvalStatus: {
    approved: 'مقبول',
    pending: 'بانتظار الموافقة',
  },
  creditStatus: {
    good: 'كويس',
    warning: 'تنبيه',
    blocked: 'موقوف',
  },
  returnWriteoffType: {
    customer_return: 'مرتجع عميل',
    damage_writeoff: 'إتلاف تالف',
  },
  returnWriteoffStatus: {
    pending: 'بانتظار الموافقة',
    approved: 'اتوافق',
    rejected: 'مرفوض',
  },
  stockCountStatus: {
    open: 'مفتوح',
    submitted: 'اترفع',
    signed_off: 'اتعتمد',
  },
  accountCategory: {
    cash: 'الصندوق (كاش)',
    bank: 'البنك',
    capital: 'رأس المال',
    fixed_assets: 'المعدات والأصول',
    ar: 'فلوس ليك عند العملاء',
    ap: 'فلوس عليك للموردين',
    revenue: 'المبيعات',
    cogs: 'تكلفة البضاعة اللي اتباعت',
    expense: 'المصروفات',
    inventory: 'المخزون',
  },
  voucherType: {
    receipt: 'استلام فلوس',
    disbursement: 'صرف فلوس',
  },
  taskStatus: {
    not_started: 'لسه مابدأتش',
    in_progress: 'شغّالة',
    done: 'خلصت',
    cancelled: 'اتلغت',
  },
  taskPriority: {
    low: 'عادية',
    medium: 'متوسطة',
    high: 'مهمة',
    urgent: 'عاجلة',
  },
  // Customer portal (external customers)
  crmOrderStatus: {
    pending: 'قيد المراجعة',
    approved: 'اتوافق عليه',
    processing: 'بيتجهّز',
    shipped: 'اتشحن',
    out_for_delivery: 'خرج للتوصيل',
    delivered: 'اتسلّم',
    completed: 'اكتمل',
    cancelled: 'اتلغى',
    rejected: 'اترفض',
  },
  crmPaymentStatus: {
    unpaid: 'مش مدفوع',
    partial: 'مدفوع جزئي',
    paid: 'مدفوع',
    overdue: 'متأخر',
  },
};

const BADGE_TONES: Record<string, Record<string, BadgeTone>> = {
  docStatus: { draft: 'neutral', submitted: 'success', cancelled: 'danger' },
  productionRequestStatus: {
    pending_materials: 'warning', materials_approved: 'info', rejected: 'danger',
    in_production: 'info', completed: 'success',
  },
  batchStatus: {
    draft: 'warning', confirmed: 'info', pending_qc: 'warning',
    released: 'success', rejected: 'danger', completed: 'neutral',
  },
  distributionStatus: {
    pending_approval: 'warning', approved: 'info', rejected: 'danger',
    in_transit: 'info', received_matched: 'success',
    received_discrepancy: 'warning', discrepancy_resolved: 'success',
  },
  repStockRequestStatus: {
    pending_approval: 'warning', approved: 'info', issued: 'success', rejected: 'danger',
  },
  closeoutStatus: { open: 'neutral', submitted: 'info', confirmed: 'success', variance_flagged: 'warning' },
  settlementStatus: { draft: 'neutral', submitted: 'warning', confirmed: 'success' },
  invoiceStatus: { unpaid: 'warning', partially_paid: 'info', paid: 'success', cancelled: 'danger' },
  approvalStatus: { approved: 'success', pending: 'warning' },
  creditStatus: { good: 'success', warning: 'warning', blocked: 'danger' },
  returnWriteoffStatus: { pending: 'warning', approved: 'success', rejected: 'danger' },
  stockCountStatus: { open: 'neutral', submitted: 'info', signed_off: 'success' },
  taskStatus: { not_started: 'neutral', in_progress: 'info', done: 'success', cancelled: 'danger' },
  crmOrderStatus: {
    pending: 'warning', approved: 'info', processing: 'info', shipped: 'info',
    out_for_delivery: 'info', delivered: 'success', completed: 'success',
    cancelled: 'danger', rejected: 'danger',
  },
  crmPaymentStatus: { unpaid: 'warning', partial: 'info', paid: 'success', overdue: 'danger' },
};

export function enumLabel(group: string, value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  return ENUM_LABELS[group]?.[value] ?? value;
}

export function badgeTone(group: string, value: string | null | undefined): BadgeTone {
  if (value == null) return 'neutral';
  return BADGE_TONES[group]?.[value] ?? 'neutral';
}

// Plain-Egyptian replacements for formal bookkeeping / ERP jargon. Screens
// pull labels from here so the wording stays consistent everywhere.
const TERMS: LabelMap = {
  journal_entry: 'حركة فلوس',
  debit: 'ليك',
  credit: 'عليك',
  receipt_voucher: 'إيصال استلام فلوس',
  payment_voucher: 'إيصال صرف فلوس',
  opening_balance: 'رصيد أول المدة',
  accounts_receivable: 'الفلوس اللي ليك عند العملاء',
  accounts_payable: 'الفلوس اللي عليك للموردين',
  post_to_ledger: 'تسجيل',
  posted: 'اتسجّل',
  depreciation: 'استهلاك قيمة المعدة',
  fixed_asset: 'معدة / أصل',
  operating_expense: 'مصروف',
  liquidity: 'الفلوس المتاحة',
  net_worth: 'صافي فلوس المحل',
  assets: 'اللي عندك',
  liabilities: 'اللي عليك',
  cogs: 'تكلفة البضاعة اللي اتباعت',
  aging: 'أعمار المتأخرات',
  statement_of_account: 'كشف حساب',
  bom: 'مكوّنات المنتج',
  bom_stage: 'نوع المكوّنات',
  work_order: 'أمر تشغيل',
  material_transfer: 'تحويل مخزني',
  wip: 'تحت التصنيع',
  reorder_level: 'حد التنبيه',
  daily_closeout: 'تقفيل اليوم',
  cash_variance: 'فرق الكاش',
  treasury_settlement: 'توريد للخزينة',
  permission_matrix: 'صلاحيات الأدوار',
  vat: 'الضريبة',
  tax_id: 'الرقم الضريبي',
};

export function term(key: keyof typeof TERMS | string): string {
  return TERMS[key] ?? key;
}
