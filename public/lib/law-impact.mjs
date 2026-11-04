const LAW='001561', DECREE='003814', RULE='007388';
const valuation={[LAW]:['60'],[DECREE]:['49'],[RULE]:['15']};
const spouse={[LAW]:['19'],[DECREE]:['17']};

export const transferSourceArticles = {
  'inheritance-flow':{[LAW]:['13','14','25','26']},
  'inheritance-base':{[LAW]:['25'],[DECREE]:['20-3']},
  'inheritance-deduction':{[LAW]:['18','19','20','21','22','23','23-2','24'],[DECREE]:['17','18','19','20-2']},
  'inheritance-spouse':spouse,
  'inheritance-nts-2015-2299':{[LAW]:['18-2','19']},
  'inheritance-court-2023du44061':spouse,
  'gift-flow':{[LAW]:['26','47','55','56']},
  'gift-base':{[LAW]:['53','53-2','54','55'],[DECREE]:['46-2']},
  'gift-deduction':{[LAW]:['4','53','53-2']},
  'gift-home-value':valuation,
  'gift-nts-2024-1717':{[LAW]:['4','36','53','53-2']},
  'gift-court-2022du55606':valuation
};

const transferCalculationRules = {
  inheritance:[
    {label:'상속세 과세표준·과세최저한',articles:{[LAW]:['25']}},
    {label:'상속세 기본세율·누진공제',articles:{[LAW]:['26']}}
  ],
  gift:[
    {label:'증여세 과세표준·과세최저한',articles:{[LAW]:['55']}},
    {label:'증여세 기본세율·누진공제',articles:{[LAW]:['26','56']}}
  ]
};

function matchingAmendments(review,references){
  if(!references)return [];
  return (review?.amendments??[]).flatMap(amendment=>{
    const articles=amendment.articles?.filter(article=>references[amendment.lawId]?.includes(article));
    return articles?.length?[{...amendment,articles}]:[];
  });
}

export function sourceImpact(review,sourceId){
  return matchingAmendments(review,transferSourceArticles[sourceId]);
}

export function calculationImpact(review,tax){
  return (transferCalculationRules[tax]??[]).flatMap(rule=>{
    const amendments=matchingAmendments(review,rule.articles);
    return amendments.length?[{label:rule.label,amendments}]:[];
  });
}
