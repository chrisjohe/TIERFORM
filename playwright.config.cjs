const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
  testDir:'test/browser',timeout:90000,expect:{timeout:20000},fullyParallel:false,workers:1,
  reporter:'list',use:{viewport:{width:1440,height:1000},acceptDownloads:true,trace:'retain-on-failure'},
  webServer:{command:'node scripts/serve.mjs',url:'http://127.0.0.1:4173/TIERFORM/',reuseExistingServer:!process.env.CI},
  projects:['chromium','firefox','webkit'].flatMap(browserName=>['offline','hosted'].map(distribution=>({
    name:browserName+'-'+distribution,use:{browserName},metadata:{distribution}
  })))
});
