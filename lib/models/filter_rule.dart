class FilterRule {
  final String name;
  final bool nEn; final String nOp; final String nVal; final bool nNeg;
  final bool sEn; final String sOp; final double sVal; final String sUnit; final bool sNeg;
  final bool eEn; final String eVal; final bool eNeg;
  final bool dEn; final String dOp; final int dVal; final String dUnit; final bool dNeg;
  final bool emEn; final bool emNeg;

  const FilterRule({
    this.name = '',
    this.nEn = false, this.nOp = 'contains', this.nVal = '', this.nNeg = false,
    this.sEn = false, this.sOp = 'gt', this.sVal = 10, this.sUnit = 'MB', this.sNeg = false,
    this.eEn = false, this.eVal = '', this.eNeg = false,
    this.dEn = false, this.dOp = 'lt', this.dVal = 7, this.dUnit = 'day', this.dNeg = false,
    this.emEn = false, this.emNeg = false,
  });

  Map<String, dynamic> toJson() => {
    'name':name,'nEn':nEn,'nOp':nOp,'nVal':nVal,'nNeg':nNeg,
    'sEn':sEn,'sOp':sOp,'sVal':sVal,'sUnit':sUnit,'sNeg':sNeg,
    'eEn':eEn,'eVal':eVal,'eNeg':eNeg,
    'dEn':dEn,'dOp':dOp,'dVal':dVal,'dUnit':dUnit,'dNeg':dNeg,
    'emEn':emEn,'emNeg':emNeg,
  };

  factory FilterRule.fromJson(Map<String, dynamic> j) => FilterRule(
    name: j['name']??'', nEn: j['nEn']??false, nOp: j['nOp']??'contains', nVal: j['nVal']??'', nNeg: j['nNeg']??false,
    sEn: j['sEn']??false, sOp: j['sOp']??'gt', sVal: (j['sVal']??10).toDouble(), sUnit: j['sUnit']??'MB', sNeg: j['sNeg']??false,
    eEn: j['eEn']??false, eVal: j['eVal']??'', eNeg: j['eNeg']??false,
    dEn: j['dEn']??false, dOp: j['dOp']??'lt', dVal: j['dVal']??7, dUnit: j['dUnit']??'day', dNeg: j['dNeg']??false,
    emEn: j['emEn']??false, emNeg: j['emNeg']??false,
  );
}
