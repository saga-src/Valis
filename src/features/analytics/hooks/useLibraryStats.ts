import { useCoreAnalytics } from './useCoreAnalytics';

export const useLibraryStats = () => {
  const { library, loading } = useCoreAnalytics();
  
  const totalGames = library.length;
  
  // Calculate average completion based on status
  // Beat or Completed counts as finished for this simple metric
  const finishedCount = library.filter(g => g.status === 'Completed' || g.status === 'Beat').length;
  const averageCompletion = totalGames > 0 ? (finishedCount / totalGames) * 100 : 0;

  return { totalGames, averageCompletion, isLoading: loading };
};