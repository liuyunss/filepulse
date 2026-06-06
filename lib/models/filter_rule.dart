class FilterRule {
  String name;

  // 名称筛选
  bool nameFilterEnabled;
  String nameOperator; // contains, prefix, suffix
  String nameValue;
  bool nameNegate;

  // 大小筛选
  bool sizeFilterEnabled;
  String sizeOperator; // gt, lt, eq
  double sizeValue;
  String sizeUnit; // KB, MB, GB
  bool sizeNegate;

  // 后缀筛选
  bool extFilterEnabled;
  String extValue;
  bool extNegate;

  // 日期筛选
  bool dateFilterEnabled;
  int dateValue;
  bool dateNegate;

  // 空文件夹筛选
  bool emptyFilterEnabled;
  bool emptyNegate;

  FilterRule({
    this.name = '',
    this.nameFilterEnabled = false,
    this.nameOperator = 'contains',
    this.nameValue = '',
    this.nameNegate = false,
    this.sizeFilterEnabled = false,
    this.sizeOperator = 'gt',
    this.sizeValue = 10,
    this.sizeUnit = 'MB',
    this.sizeNegate = false,
    this.extFilterEnabled = false,
    this.extValue = '',
    this.extNegate = false,
    this.dateFilterEnabled = false,
    this.dateValue = 7,
    this.dateNegate = false,
    this.emptyFilterEnabled = false,
    this.emptyNegate = false,
  });

  Map<String, dynamic> toJson() => {
        'name': name,
        'nameFilterEnabled': nameFilterEnabled,
        'nameOperator': nameOperator,
        'nameValue': nameValue,
        'nameNegate': nameNegate,
        'sizeFilterEnabled': sizeFilterEnabled,
        'sizeOperator': sizeOperator,
        'sizeValue': sizeValue,
        'sizeUnit': sizeUnit,
        'sizeNegate': sizeNegate,
        'extFilterEnabled': extFilterEnabled,
        'extValue': extValue,
        'extNegate': extNegate,
        'dateFilterEnabled': dateFilterEnabled,
        'dateValue': dateValue,
        'dateNegate': dateNegate,
        'emptyFilterEnabled': emptyFilterEnabled,
        'emptyNegate': emptyNegate,
      };

  factory FilterRule.fromJson(Map<String, dynamic> json) => FilterRule(
        name: json['name'] ?? '',
        nameFilterEnabled: json['nameFilterEnabled'] ?? false,
        nameOperator: json['nameOperator'] ?? 'contains',
        nameValue: json['nameValue'] ?? '',
        nameNegate: json['nameNegate'] ?? false,
        sizeFilterEnabled: json['sizeFilterEnabled'] ?? false,
        sizeOperator: json['sizeOperator'] ?? 'gt',
        sizeValue: (json['sizeValue'] ?? 10).toDouble(),
        sizeUnit: json['sizeUnit'] ?? 'MB',
        sizeNegate: json['sizeNegate'] ?? false,
        extFilterEnabled: json['extFilterEnabled'] ?? false,
        extValue: json['extValue'] ?? '',
        extNegate: json['extNegate'] ?? false,
        dateFilterEnabled: json['dateFilterEnabled'] ?? false,
        dateValue: json['dateValue'] ?? 7,
        dateNegate: json['dateNegate'] ?? false,
        emptyFilterEnabled: json['emptyFilterEnabled'] ?? false,
        emptyNegate: json['emptyNegate'] ?? false,
      );
}
