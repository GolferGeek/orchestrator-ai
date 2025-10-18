#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function cleanupKpiData() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🧪 Cleaning KPI Test Data');
  console.log('=========================\n');
  
  // Clean kpi_data - keep 1000 most recent
  try {
    console.log('📊 Cleaning kpi_data...');
    
    // Get IDs of oldest records to delete
    const { data: oldestIds, error: selectError } = await supabase
      .from('kpi_data')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(10182); // Total - 1000 we want to keep
    
    if (selectError) {
      console.log('❌ Error selecting old kpi_data records:', selectError.message);
    } else if (oldestIds && oldestIds.length > 0) {
      console.log(`   └─ Found ${oldestIds.length} old records to remove`);
      
      const idsToDelete = oldestIds.map(record => record.id);
      
      // Delete in batches to avoid timeout
      const batchSize = 1000;
      let deletedCount = 0;
      
      for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize);
        const { error: deleteError } = await supabase
          .from('kpi_data')
          .delete()
          .in('id', batch);
        
        if (deleteError) {
          console.log(`   └─ ❌ Error deleting batch: ${deleteError.message}`);
          break;
        } else {
          deletedCount += batch.length;
          console.log(`   └─ Deleted ${deletedCount}/${idsToDelete.length} records...`);
        }
      }
      
      console.log(`   └─ ✅ Cleaned kpi_data: ${deletedCount} records removed`);
    } else {
      console.log('   └─ No old records found to clean');
    }
  } catch (error) {
    console.log('   └─ ⚠️  Error cleaning kpi_data:', error.message);
  }

  // Clean kpi_goals - keep 500 most recent
  try {
    console.log('\n📊 Cleaning kpi_goals...');
    
    const { data: oldestGoals, error: selectError } = await supabase
      .from('kpi_goals')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(3352); // Total - 500 we want to keep
    
    if (selectError) {
      console.log('❌ Error selecting old kpi_goals records:', selectError.message);
    } else if (oldestGoals && oldestGoals.length > 0) {
      console.log(`   └─ Found ${oldestGoals.length} old records to remove`);
      
      const idsToDelete = oldestGoals.map(record => record.id);
      
      // Delete in batches
      const batchSize = 1000;
      let deletedCount = 0;
      
      for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize);
        const { error: deleteError } = await supabase
          .from('kpi_goals')
          .delete()
          .in('id', batch);
        
        if (deleteError) {
          console.log(`   └─ ❌ Error deleting batch: ${deleteError.message}`);
          break;
        } else {
          deletedCount += batch.length;
          console.log(`   └─ Deleted ${deletedCount}/${idsToDelete.length} records...`);
        }
      }
      
      console.log(`   └─ ✅ Cleaned kpi_goals: ${deletedCount} records removed`);
    } else {
      console.log('   └─ No old records found to clean');
    }
  } catch (error) {
    console.log('   └─ ⚠️  Error cleaning kpi_goals:', error.message);
  }

  // Show final counts
  console.log('\n📈 Final KPI Data Summary:');
  console.log('==========================');
  
  try {
    const { data: kpiCount } = await supabase
      .from('kpi_data')
      .select('id', { count: 'exact', head: true });
    console.log(`📊 kpi_data: ${kpiCount?.length || 'unknown'} rows remaining`);
  } catch (error) {
    console.log('📊 kpi_data: Unable to count');
  }
  
  try {
    const { data: goalsCount } = await supabase
      .from('kpi_goals')
      .select('id', { count: 'exact', head: true });
    console.log(`📊 kpi_goals: ${goalsCount?.length || 'unknown'} rows remaining`);
  } catch (error) {
    console.log('📊 kpi_goals: Unable to count');
  }
  
  console.log('\n🎉 KPI Data Cleanup Complete!');
}

cleanupKpiData().catch(error => {
  console.error('\n💥 KPI cleanup failed:', error);
  process.exit(1);
});