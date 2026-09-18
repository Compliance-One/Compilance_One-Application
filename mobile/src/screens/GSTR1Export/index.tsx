/**
 * GSTR1Export Screen — matches GST Voice Billing UI design
 * Tax Period card, Generate JSON button, Export Excel, View Summary,
 * note about uploading to GST Portal
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../store/useAppStore';

const G_DARK = '#1B5E20';
const G_MED  = '#2E7D32';

export default function GSTR1ExportScreen() {
  const router   = useRouter();
  const business = useAppStore((s) => s.business);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const currentMonth = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const fromDate = '01 Jul 2025';
  const toDate   = '31 Jul 2025';

  const stats = {
    totalInvoices: 156,
    totalB2B:       98,
    totalB2C:       58,
  };

  const handleGenerate = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 2000));
    setLoading(false);
    setGenerated(true);
    Alert.alert('✅ GSTR-1 JSON Generated', 'The GSTR-1 JSON file has been created.\nYou can now export it to Excel or upload it to the GST Portal.');
  };

  const handleExcelExport = () => {
    if (!generated) {
      Alert.alert('Generate First', 'Please generate GSTR-1 JSON first.');
      return;
    }
    Alert.alert('📊 Excel Export', 'GSTR-1 data exported to Excel successfully!\n\nFile: GSTR1_Jul2025.xlsx');
  };

  const handleSummary = () => {
    if (!generated) {
      Alert.alert('Generate First', 'Please generate GSTR-1 JSON first.');
      return;
    }
    Alert.alert('GSTR-1 Summary', `Tax Period: July 2025\n\nTotal Invoices: ${stats.totalInvoices}\nB2B Invoices: ${stats.totalB2B}\nB2C Invoices: ${stats.totalB2C}\n\nTotal Taxable Value: ₹1,18,600\nTotal CGST: ₹3,415\nTotal SGST: ₹3,415\nTotal IGST: ₹0`);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>GSTR-1 Export</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Tax Period Card */}
        <View style={styles.periodCard}>
          <Text style={styles.periodLabel}>Tax Period</Text>
          <Text style={styles.periodMonth}>July 2025</Text>
          <View style={styles.periodRow}>
            <View style={styles.periodSide}>
              <Text style={styles.periodKey}>From</Text>
              <Text style={styles.periodDate}>{fromDate}</Text>
            </View>
            <View style={styles.periodDivider} />
            <View style={styles.periodSide}>
              <Text style={styles.periodKey}>To</Text>
              <Text style={styles.periodDate}>{toDate}</Text>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Invoices</Text>
            <Text style={styles.statValue}>{stats.totalInvoices}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total B2B</Text>
            <Text style={[styles.statValue, { color: '#1565C0' }]}>{stats.totalB2B}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total B2C</Text>
            <Text style={[styles.statValue, { color: '#E65100' }]}>{stats.totalB2C}</Text>
          </View>
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          style={[styles.generateBtn, loading && styles.generateBtnLoading]}
          onPress={handleGenerate}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.generateIcon}>{loading ? '⏳' : generated ? '✅' : '🏛️'}</Text>
          <Text style={styles.generateText}>
            {loading ? 'Generating...' : generated ? 'Re-generate GSTR-1 JSON' : 'Generate GSTR-1 JSON'}
          </Text>
        </TouchableOpacity>

        {/* Action Buttons */}
        <TouchableOpacity
          style={[styles.actionBtn, !generated && styles.actionBtnDisabled]}
          onPress={handleExcelExport}
        >
          <Text style={styles.actionIcon}>📊</Text>
          <Text style={[styles.actionText, !generated && styles.actionTextDisabled]}>Export as Excel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, !generated && styles.actionBtnDisabled]}
          onPress={handleSummary}
        >
          <Text style={styles.actionIcon}>📋</Text>
          <Text style={[styles.actionText, !generated && styles.actionTextDisabled]}>View Summary</Text>
        </TouchableOpacity>

        {/* Note */}
        <View style={styles.noteCard}>
          <Text style={styles.noteIcon}>ℹ️</Text>
          <Text style={styles.noteText}>
            <Text style={{ fontWeight: '700' }}>Note:</Text> Upload the JSON file in GST Portal{'\n'}
            (Returns › GSTR-1 › Offline Tools)
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#F0F4F0' },
  topBar:       { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  backBtn:      { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backArrow:    { fontSize: 28, color: G_DARK, lineHeight: 30 },
  topTitle:     { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: G_DARK },
  scroll:       { flex: 1 },
  content:      { padding: 16 },
  periodCard:   { backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  periodLabel:  { fontSize: 12, fontWeight: '700', color: '#9E9E9E', textTransform: 'uppercase', letterSpacing: 0.5 },
  periodMonth:  { fontSize: 22, fontWeight: '900', color: G_DARK, marginTop: 4, marginBottom: 14 },
  periodRow:    { flexDirection: 'row', alignItems: 'center' },
  periodSide:   { flex: 1 },
  periodKey:    { fontSize: 12, color: '#9E9E9E', marginBottom: 4 },
  periodDate:   { fontSize: 15, fontWeight: '700', color: '#212121' },
  periodDivider:{ width: 1, height: 40, backgroundColor: '#E0E0E0', marginHorizontal: 16 },
  statsRow:     { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard:     { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  statLabel:    { fontSize: 11, color: '#9E9E9E', marginBottom: 4 },
  statValue:    { fontSize: 22, fontWeight: '900', color: G_DARK },
  generateBtn:  { backgroundColor: G_DARK, borderRadius: 14, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12, elevation: 4, shadowColor: G_DARK, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  generateBtnLoading: { backgroundColor: '#9E9E9E' },
  generateIcon: { fontSize: 22 },
  generateText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  actionBtn:    { backgroundColor: '#fff', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E8F5E9', elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  actionBtnDisabled: { opacity: 0.5 },
  actionIcon:   { fontSize: 22 },
  actionText:   { fontSize: 15, fontWeight: '700', color: G_DARK },
  actionTextDisabled: { color: '#9E9E9E' },
  noteCard:     { backgroundColor: '#FFF8E1', borderRadius: 12, padding: 14, flexDirection: 'row', gap: 10, marginTop: 4, borderWidth: 1, borderColor: '#FFE082' },
  noteIcon:     { fontSize: 18 },
  noteText:     { flex: 1, fontSize: 13, color: '#5D4037', lineHeight: 20 },
});
