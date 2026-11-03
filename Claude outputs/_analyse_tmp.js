require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
(async()=>{
 const q=async(s,l)=>{try{const r=await p.query(s);console.log('\n== '+l);console.table(r.rows)}catch(e){console.log('\n== '+l+' FEHLER: '+e.message)}};
 await q(`select count(*) n, min(created_at)::date erste, max(created_at)::date letzte, round(sum(total_amount)::numeric,2) umsatz, string_agg(distinct status,',') status from orders`,'Bestellungen gesamt');
 await q(`select to_char(created_at,'YYYY-MM') monat, count(*) n, round(sum(total_amount)::numeric,2) umsatz from orders group by 1 order by 1`,'Bestellungen je Monat');
 await q(`select oi.product_id, oi.product_name, sum(oi.quantity) stueck, count(distinct oi.order_id) bestellungen, round(sum(oi.quantity*oi.price)::numeric,2) umsatz from order_items oi group by 1,2 order by 3 desc limit 25`,'Verkaufte Artikel');
 await q(`select status, count(*) from orders group by 1`,'Status');
 await q(`select page, count(*) aufrufe from page_views where created_at > now()-interval '90 days' and page like '%produkte%' group by 1 order by 2 desc limit 20`,'Top Produktseiten 90 Tage');
 await q(`select query, count(*) n, sum(case when results=0 then 1 else 0 end) null_treffer from search_events group by 1 order by 2 desc limit 20`,'Suchbegriffe');
 await q(`select count(*) n, sum(case when status='confirmed' then 1 else 0 end) bestaetigt from newsletter_subscribers`,'Newsletter');
 await q(`select count(*) from stock_notifications`,'Vormerkungen');
 await q(`select product_id, in_stock, updated_at::date from cj_stock_watch order by product_id`,'CJ Bestand');
 await p.end();
})();
