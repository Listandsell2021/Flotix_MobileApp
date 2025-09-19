import React from 'react';
import { ViewStyle } from 'react-native';
import {
  Home,
  Plus,
  BarChart3,
  User,
  Car,
  Fuel,
  Receipt,
  Target,
  Euro,
  TrendingUp,
  Camera,
  X,
  Search,
  Filter,
  ArrowUpDown,
  ChevronRight,
  ChevronLeft,
  Edit,
  Trash2,
  Settings,
  LogOut,
  Check,
  Info,
  AlertTriangle,
  XCircle,
  Clock,
  Calendar,
  MapPin,
  FileText,
  Upload,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
  MoreVertical,
  Image,
  Folder,
  Layers,
  ChevronRight as ChevronRightIcon,
  LucideIcon
} from 'lucide-react-native';
import { theme } from '../styles/theme';

export type IconName = 
  | 'home'
  | 'plus'
  | 'chart'
  | 'user'
  | 'car'
  | 'fuel'
  | 'receipt'
  | 'target'
  | 'money'
  | 'trend-up'
  | 'camera'
  | 'close'
  | 'search'
  | 'filter'
  | 'sort'
  | 'arrow-right'
  | 'arrow-left'
  | 'edit'
  | 'delete'
  | 'settings'
  | 'logout'
  | 'check'
  | 'info'
  | 'warning'
  | 'error'
  | 'clock'
  | 'calendar'
  | 'location'
  | 'document'
  | 'upload'
  | 'download'
  | 'eye'
  | 'eye-off'
  | 'refresh'
  | 'more'
  | 'image'
  | 'folder'
  | 'stack'
  | 'chevron-right';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: ViewStyle;
  strokeWidth?: number;
}

const Icon: React.FC<IconProps> = ({ 
  name, 
  size = 24, 
  color = theme.colors.text, 
  style,
  strokeWidth = 2 
}) => {
  const getLucideIcon = (iconName: IconName): LucideIcon => {
    switch (iconName) {
      case 'home': return Home;
      case 'plus': return Plus;
      case 'chart': return BarChart3;
      case 'user': return User;
      case 'car': return Car;
      case 'fuel': return Fuel;
      case 'receipt': return Receipt;
      case 'target': return Target;
      case 'money': return Euro;
      case 'trend-up': return TrendingUp;
      case 'camera': return Camera;
      case 'close': return X;
      case 'search': return Search;
      case 'filter': return Filter;
      case 'sort': return ArrowUpDown;
      case 'arrow-right': return ChevronRight;
      case 'arrow-left': return ChevronLeft;
      case 'edit': return Edit;
      case 'delete': return Trash2;
      case 'settings': return Settings;
      case 'logout': return LogOut;
      case 'check': return Check;
      case 'info': return Info;
      case 'warning': return AlertTriangle;
      case 'error': return XCircle;
      case 'clock': return Clock;
      case 'calendar': return Calendar;
      case 'location': return MapPin;
      case 'document': return FileText;
      case 'upload': return Upload;
      case 'download': return Download;
      case 'eye': return Eye;
      case 'eye-off': return EyeOff;
      case 'refresh': return RefreshCw;
      case 'more': return MoreVertical;
      case 'image': return Image;
      case 'folder': return Folder;
      case 'stack': return Layers;
      case 'chevron-right': return ChevronRightIcon;
      default: return Home;
    }
  };

  const LucideIconComponent = getLucideIcon(name);

  return (
    <LucideIconComponent
      size={size}
      color={color}
      style={style}
      strokeWidth={strokeWidth}
    />
  );
};

export default Icon;