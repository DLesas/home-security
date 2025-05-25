import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { View, Text } from 'react-native';

export const CustomDrawerContent = (props: any) => {
  return (
    <DrawerContentScrollView {...props} className="bg-background">
      <View className="p-4">
        <Text className="text-red-500">Hello</Text>
        <DrawerItemList {...props} />
      </View>
    </DrawerContentScrollView>
  );
}; 