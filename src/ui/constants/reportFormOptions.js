const purposeOptions = [
  { value: "to set", label: "Select" },
  { value: "1", label: "Selling" },
  { value: "2", label: "Buying" },
  { value: "5", label: "Rent Value" },
  { value: "6", label: "Insurance" },
  { value: "8", label: "Accounting Purposes" },
  { value: "9", label: "Financing" },
  { value: "10", label: "Disputes and Litigation" },
  { value: "12", label: "Tax Related Valuations" },
  { value: "14", label: "Other" },
];

const valuePremiseOptions = [
  { value: "to set", label: "Select" },
  { value: "1", label: "Highest and Best Use" },
  { value: "2", label: "Current Use" },
  { value: "3", label: "Orderly Liquidation" },
  { value: "4", label: "Forced Sale" },
  { value: "5", label: "Other" },
];

const reportTypeOptions = [
  { value: "تقرير مفصل", label: "Detailed Report" },
  { value: "ملخص التقرير", label: "Report Summary" },
  {
    value: "مراجعة مع قيمة جديدة",
    label: "Review with New Value",
  },
  {
    value: "مراجعة بدون قيمة جديدة",
    label: "Review without New Value",
  },
];

const currencyOptions = [
  { value: "to set", label: "Select" },
  { value: "1", label: "Saudi Riyal" },
  { value: "2", label: "US Dollars" },
  { value: "3", label: "UA Dirhams" },
  { value: "4", label: "Euro" },
  { value: "5", label: "Pound Sterling" },
  { value: "6", label: "Sudanese Pound" },
];

const contributionOptions = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95,
  100,
];

const valuerOptions = [
  "4210000352 - حسام سعيد علي الاسمري",
  "4210000088 - أحمد محمد عبدالله ابابطين",
  "4210000102 - خالد عبدالكريم بن عبدالعزيز الجاسر",
  "4210000091 - هاني ابراهيم محمد رواس",
  "4210000334 - سعيد بن علي بن سعيد الزهراني",
  "4210000375 - احمد زبن دبيان الروقي",
  "4210000059 - عبدالله بن عبدالرحمن بن عبدالله الصعب",
  "4210000096 - سيف مساعد بن فالح الحربي",
  "4210000258 - فايز عويض ساير الحربي",
  "4210000010 - حمزه مشبب فهد العاصمي",
  "4210000364 - أسامه محمد بن قائد هزازي",
  "4210000113 - مالك انس سليمان حافظ",
  "4210000078 - رائد ناصر عبدالله العميره",
  "4210000183 - فيصل عايض جربوع الرويلي",
  "4210000170 - عبدالله نجيب بن خالد الحليبي",
  "4210000193 - محمد حمود عبدالرحمن العايد",
  "4210000282 - عبيد مناحي سياف الشهراني",
  "4210000356 - بندر عبدالله ابن سعد الهويمل",
  "4210000374 - لميس حسن جميل ثقه",
  "4210000210 - عبدالرحمن مساعد محمدراشد الصبحي",
  "4210000382 - ناصر عبدالله ابراهيم البصيص",
  "4210000201 - فهد محمد عيد الرشيدي",
  "4210000285 - تركي محمد عبدالمحسن الحربي",
  "4220000293 - عمر سالم عثمان على",
  "4210000277 - حسين علي بن احمد ابوحسون",
  "4210000323 - علي بن معتوق بن ابراهيم الحسين",
  "4210000347 - عبدالله محمد عبدالله العجاجى",
  "4210000296 - فالح مفلح فالح الشهراني",
  "4210000335 - خالد محمد ابراهيم العضيبى",
  "4210000346 - عبدالله احمد عبدالله الغامدي",
  "4210000340 - شريفة سعيد عوض القحطاني",
  "4210000381 - آحمد ابراهيم عبدالعزيز اللهيب",
  "4210000369 - سعود حسين بن علي آل فطيح",
  "4210000366 - حسام موسى سعد السويري",
  "4210000008 - حمد عبدالله ناصر الحمد",
];

const buildDefaultValuers = () => [
  {
    valuer_name: "4210000296 - فالح مفلح فالح الشهراني",
    contribution_percentage: 100,
  },
];

module.exports = {
  purposeOptions,
  valuePremiseOptions,
  reportTypeOptions,
  currencyOptions,
  contributionOptions,
  valuerOptions,
  buildDefaultValuers,
};
