import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

export type InvoiceStatus = 'PAID' | 'PENDING' | 'CANCELLED' | 'OVERDUE';

export interface InvoiceCardData {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerGstin?: string;
  date: string; // ISO date string or formatted date
  dueDate?: string;
  totalAmount: number;
  balanceDue?: number;
  status: InvoiceStatus;
  itemsCount: number;
}

export interface InvoiceCardProps {
  invoice: InvoiceCardData;
  onPress?: (invoice: InvoiceCardData) => void;
  onDownload?: (invoice: InvoiceCardData) => void;
  onShare?: (invoice: InvoiceCardData) => void;
  containerStyle?: ViewStyle;
}

const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; badgeBg: string; textColor: string; borderColor: string }
> = {
  PAID: {
    label: 'PAID',
    badgeBg: '#E8F5E9',
    textColor: '#2E7D32',
    borderColor: '#A5D6A7',
  },
  PENDING: {
    label: 'PENDING',
    badgeBg: '#FFF8E1',
    textColor: '#F57F17',
    borderColor: '#FFE082',
  },
  OVERDUE: {
    label: 'OVERDUE',
    badgeBg: '#FFEBEE',
    textColor: '#C62828',
    borderColor: '#FFCDD2',
  },
  CANCELLED: {
    label: 'CANCELLED',
    badgeBg: '#ECEFF1',
    textColor: '#546E7A',
    borderColor: '#CFD8DC',
  },
};

export const formatINR = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export const InvoiceCard: React.FC<InvoiceCardProps> = ({
  invoice,
  onPress,
  onDownload,
  onShare,
  containerStyle,
}) => {
  const statusMeta = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.PENDING;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      style={[styles.card, containerStyle]}
      onPress={() => onPress && onPress(invoice)}
    >
      {/* Top Header: Invoice Number & Status Badge */}
      <View style={styles.headerRow}>
        <View style={styles.invoiceNoContainer}>
          <Text style={styles.invoiceNoPrefix}>#</Text>
          <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
        </View>

        <View
          style={[
            styles.badge,
            {
              backgroundColor: statusMeta.badgeBg,
              borderColor: statusMeta.borderColor,
            },
          ]}
        >
          <Text style={[styles.badgeText, { color: statusMeta.textColor }]}>
            {statusMeta.label}
          </Text>
        </View>
      </View>

      {/* Middle Row: Customer Info */}
      <View style={styles.customerRow}>
        <Text style={styles.customerName} numberOfLines={1}>
          {invoice.customerName}
        </Text>
        {invoice.customerGstin ? (
          <Text style={styles.customerGstin}>GSTIN: {invoice.customerGstin}</Text>
        ) : null}
      </View>

      {/* Meta Row: Date, Items Count, Total Amount */}
      <View style={styles.metaRow}>
        <View style={styles.dateAndItems}>
          <Text style={styles.metaLabel}>Issued: {formatDate(invoice.date)}</Text>
          <Text style={styles.metaSub}>
            {invoice.itemsCount} {invoice.itemsCount === 1 ? 'item' : 'items'}
            {invoice.dueDate ? ` • Due: ${formatDate(invoice.dueDate)}` : ''}
          </Text>
        </View>

        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>Total Amount</Text>
          <Text style={styles.totalAmount}>{formatINR(invoice.totalAmount)}</Text>
          {invoice.balanceDue !== undefined && invoice.balanceDue > 0 ? (
            <Text style={styles.balanceDue}>
              Bal: {formatINR(invoice.balanceDue)}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Action Footer if handlers provided */}
      {(onDownload || onShare) && (
        <View style={styles.actionRow}>
          {onDownload && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onDownload(invoice)}
            >
              <Text style={styles.actionBtnText}>Download PDF</Text>
            </TouchableOpacity>
          )}

          {onShare && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.shareBtn]}
              onPress={() => onShare(invoice)}
            >
              <Text style={[styles.actionBtnText, styles.shareBtnText]}>
                Share
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  invoiceNoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  invoiceNoPrefix: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
    marginRight: 2,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  customerRow: {
    marginBottom: 12,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  customerGstin: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  dateAndItems: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 12,
    color: '#4B5563',
  },
  metaSub: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amountLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  totalAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  balanceDue: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  shareBtn: {
    backgroundColor: '#EEF2FF',
  },
  shareBtnText: {
    color: '#4F46E5',
  },
});

export default InvoiceCard;

