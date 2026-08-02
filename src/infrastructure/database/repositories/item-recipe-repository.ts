import { BaseRepository } from '../base-repository';
import { IItemRecipeRepository } from '../../../core/interfaces/repository';
import { ItemRecipe } from '../../../core/domain/entities';

export class ItemRecipeRepository extends BaseRepository<ItemRecipe> implements IItemRecipeRepository {
  constructor() {
    super('item_recipes');
  }

  async findByParentItemId(parentItemId: string): Promise<ItemRecipe[]> {
    return await this.table.filter((recipe: ItemRecipe) => recipe.parent_item_id === parentItemId).toArray();
  }

  async findByType(recipeType: string): Promise<ItemRecipe[]> {
    return await this.table.filter((recipe: ItemRecipe) => recipe.recipe_type === recipeType).toArray();
  }
}
