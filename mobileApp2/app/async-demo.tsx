import { View, Text, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';

// Simulate an API call
const fetchData = async () => {
  await new Promise(resolve => setTimeout(resolve, 2000));
  return {
    message: 'Async content loaded!',
    items: [
      { id: 1, name: 'Item 1', image: 'https://picsum.photos/200' },
      { id: 2, name: 'Item 2', image: 'https://picsum.photos/201' },
      { id: 3, name: 'Item 3', image: 'https://picsum.photos/202' },
      { id: 4, name: 'Item 4', image: 'https://picsum.photos/203' },
      { id: 5, name: 'Item 5', image: 'https://picsum.photos/204' },
    ]
  };
};

export default function AsyncDemo() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['async-demo'],
    queryFn: fetchData,
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="hsl(var(--primary))" />
        <Text className="mt-4 text-foreground">Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-destructive mb-4">Failed to load content</Text>
        <Text 
          className="text-primary" 
          onPress={() => refetch()}
        >
          Retry
        </Text>
      </View>
    );
  }

  return (
    <ScrollView 
      className="flex-1 bg-background"
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refetch}
          tintColor="hsl(var(--primary))"
        />
      }
    >
      <View className="p-4">
        <Text className="text-foreground text-xl font-bold mb-4">{data?.message}</Text>
        
        <Text className="text-foreground text-lg font-semibold mb-2">Featured Items</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          className="flex-row"
        >
          {data?.items.map((item) => (
            <Card key={item.id} className="w-40 mr-4">
              <CardHeader className="items-center">
                <Avatar alt={item.name} className="w-20 h-20">
                  <AvatarImage source={{ uri: item.image }} />
                  <AvatarFallback>{item.name[0]}</AvatarFallback>
                </Avatar>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-center">{item.name}</CardTitle>
              </CardContent>
            </Card>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
} 