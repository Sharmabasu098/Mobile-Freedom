import { describe, expect, it } from "vitest";
import { predictStorageHistory, predictStorageUsage } from "./storagePrediction";
import { createStorageHistoryStore, type StorageHistoryStorage } from "./storageHistory";
import type { StorageSnapshot } from "./storageSnapshot";

const day = 86_400_000;
function snap(id: string, dayOffset: number, used: number, capacity = 1000): StorageSnapshot {
  const date = new Date(Date.UTC(2026, 0, 1) + dayOffset * day);
  return { id, recordedAt: date.toISOString(), totalBytes: capacity, usedBytes: used, freeBytes: capacity - used, source: "user-provided" };
}
function series(rates: number[] = [10,10,10,10,10,10], capacity=1000): StorageSnapshot[] {
  const values=[100];
  rates.forEach((r)=>values.push(values[values.length-1]+r));
  return values.map((v,i)=>snap(String(i),i*2,v,capacity));
}
class Mem implements StorageHistoryStorage {
  values=new Map<string,string>();
  getItem(k:string){return this.values.get(k)??null;}
  setItem(k:string,v:string){this.values.set(k,v);}
  removeItem(k:string){this.values.delete(k);}
}
describe("M12.4 storage prediction",()=>{
  it("projects median daily growth using elapsed time",()=>{
    expect(predictStorageUsage(series(),7)).toMatchObject({success:true,estimatedUsedBytes:195,medianDailyGrowthBytes:5,horizonDays:7});
  });
  it("supports decreasing and stable trends",()=>{
    expect(predictStorageUsage(series([-5,-5,-5,-5,-5,-5]),7)).toMatchObject({success:true,estimatedUsedBytes:53,medianDailyGrowthBytes:-2.5});
    expect(predictStorageUsage(series([0,0,0,0,0,0]),14)).toMatchObject({success:true,estimatedUsedBytes:100,medianDailyGrowthBytes:0});
  });
  it("rejects unsupported forecast horizons",()=>{
    for(const horizon of [0,1,8,31,7.5]) expect(predictStorageUsage(series(),horizon)).toMatchObject({success:false,reason:"invalid-horizon"});
  });
  it("rejects fewer than seven snapshots and less than seven days",()=>{
    expect(predictStorageUsage(series().slice(0,6),7)).toMatchObject({success:false,reason:"insufficient-history"});
    expect(predictStorageUsage(series().map((s)=>({...s,recordedAt:new Date(Date.parse(s.recordedAt)/2).toISOString()})),7)).toMatchObject({success:false,reason:"insufficient-history"});
  });
  it("rejects duplicate IDs, invalid data, and zero intervals",()=>{
    const duplicate=series(); duplicate[1]={...duplicate[1],id:duplicate[0].id};
    expect(predictStorageUsage(duplicate,7)).toMatchObject({success:false,reason:"duplicate-snapshot-id"});
    const invalid=series(); invalid[2]={...invalid[2],freeBytes:0};
    expect(predictStorageUsage(invalid,7)).toMatchObject({success:false,reason:"invalid-snapshot"});
    const sameTime=series(); sameTime[1]={...sameTime[1],recordedAt:sameTime[0].recordedAt};
    expect(predictStorageUsage(sameTime,7)).toMatchObject({success:false,reason:"zero-or-invalid-interval"});
  });
  it("median handles one outlier rate deterministically",()=>{
    const data=series([10,10,1000,10,10,10],10000);
    const result=predictStorageUsage(data,7);
    expect(result).toMatchObject({success:true,medianDailyGrowthBytes:5});
    expect(result).toEqual(predictStorageUsage(data,7));
  });
  it("rejects highly volatile history",()=>{
    expect(predictStorageUsage(series([100,-100,100,-100,100,-100]),7)).toMatchObject({success:false,reason:"excessive-noise"});
  });
  it("withholds free-space projection when capacity changes",()=>{
    const data=series(); data[4]={...data[4],totalBytes:1500,freeBytes:1500-data[4].usedBytes};
    expect(predictStorageUsage(data,7)).toMatchObject({success:true,capacityStable:false});
    expect(predictStorageUsage(data,7)).not.toHaveProperty("estimatedFreeBytes");
  });
  it("rejects unsafe prediction arithmetic",()=>{
    const data=series([Number.MAX_SAFE_INTEGER,0,0,0,0,0]);
    expect(predictStorageUsage(data,30)).toMatchObject({success:false,reason:"invalid-snapshot"});
  });
  it("integrates validated M12.2 history store",()=>{
    const store=createStorageHistoryStore(new Mem());
    series().forEach(s=>store.addSnapshot(s));
    expect(predictStorageHistory(store,7)).toMatchObject({success:true,snapshotsAnalyzed:7});
  });
  it("returns no prediction when history store fails",()=>{
    expect(predictStorageHistory({getHistory:()=>({success:false,history:[],reason:"storage-error"})},7)).toMatchObject({success:false,reason:"history-unavailable"});
    expect(predictStorageHistory({getHistory:()=>{throw new Error("read failed")}},7)).toMatchObject({success:false,reason:"history-unavailable",historyFailure:"storage-error"});
  });
});
