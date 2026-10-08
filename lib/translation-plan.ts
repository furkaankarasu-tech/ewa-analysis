import type { EwaReport } from './ewa.ts';
import {emptyTranslations, knownSapTranslation, looksEnglish, type TranslatedFinding} from './local-translation.ts';
import {reviewedAlertTranslation} from './alert-presentation.ts';
export type TranslationTask = {kind:'finding'; index:number; field:keyof TranslatedFinding; original:string} | {kind:'recommendation'|'alert'|'decisive'; index:number; original:string};
/** One offline translation plan for screen and all selected-language exports. */
export function reportTranslationPlan(report: EwaReport) {
  const reviewed = emptyTranslations();
  reviewed.language = 'tr';
  const tasks: TranslationTask[] = [];
  const fields: (keyof TranslatedFinding)[] = ['title','evidence','impact','cause','action'];
  const translate = (text:string) => reviewedAlertTranslation(text) ?? knownSapTranslation(text);
  report.findings.forEach((item,index)=>fields.forEach(field=>{
    const original=item[field]; if(!original) return;
    const result=translate(original);
    if(result && result!==original) reviewed.findings[index]={...reviewed.findings[index],[field]:result};
    else if(looksEnglish(original)) tasks.push({kind:'finding',index,field,original});
  }));
  report.recommendations.forEach((item,index)=>{
    const result=translate(item.text);
    if(result && result!==item.text) reviewed.recommendations[index]=result;
    else if(looksEnglish(item.text)) tasks.push({kind:'recommendation',index,original:item.text});
  });
  report.alerts.items.forEach((item,index)=>{
    const result=translate(item.title);
    if(result && result!==item.title) reviewed.alerts![index]=result;
    else if(looksEnglish(item.title)) tasks.push({kind:'alert',index,original:item.title});
  });
  report.decisive.forEach((original,index)=>{
    const result=translate(original);
    if(result && result!==original) reviewed.decisive![index]=result;
    else if(looksEnglish(original)) tasks.push({kind:'decisive',index,original});
  });
  return {reviewed,tasks};
}
