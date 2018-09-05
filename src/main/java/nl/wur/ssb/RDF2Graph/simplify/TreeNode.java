package nl.wur.ssb.RDF2Graph.simplify;

import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.Queue;
import java.util.Set;


public class TreeNode
{
	/* The parent tree */
	private final Tree tree;
	/* The iri of the class node */
	public final String name;
	/* List of all parent classes */
	private LinkedList<TreeNode> parents = new LinkedList<TreeNode>();
	/* List of all child classes  */
	private LinkedList<TreeNode> childs = new LinkedList<TreeNode>();
	/*identify root node */
	private boolean isRoot;
	/*The temporary field used in the algoritm*/
	private HashMap<String,UniqueTypeLink> temporaryLinksPrepMap = new HashMap<String,UniqueTypeLink>();
	private HashSet<UniqueTypeLink> temporaryLinks = new HashSet<UniqueTypeLink>();
	private HashSet<UniqueTypeLink> temporaryLinksToRemove = new HashSet<UniqueTypeLink>();
	private int markParent;
	private boolean simplifyStep2Done = false;
	private boolean simplifyStep3Done = false;
	private int subClassOffInstanceCount = -1;
	private int classInstanceCount = 0;

	TreeNode(String name,Tree tree,int classInstanceCount)
	{
		this.isRoot = false;
		this.name = name;
		this.tree = tree;
		this.classInstanceCount = classInstanceCount;
	}

	TreeNode(Tree tree)
	{
		this.isRoot = true;
		this.name = "{{root}}";
		this.tree = tree;
	}
	public int getSubClassOffInstanceCount()
	{
		return this.subClassOffInstanceCount;
	}

	public boolean isRoot()
	{
		return this.isRoot;
	}

	void behaveAsRoot()
	{
		this.isRoot = true;
	}
	boolean setRootIfNoParents(TreeNode root)
	{
		if(this.parents.size() == 0)
		{
			this.setParent(root);
			return true;
		}
		return false;
	}
	void resetMarkParent()
	{
		this.markParent = 0;
	}

	void setParent(TreeNode parent)
	{
		this.parents.add(parent);
		parent.childs.add(this);
	}
	public void addTemporaryLink(String name,int count,int forwardMinMultiplicity,int forwardMaxMultiplicity,int reverseMinMultiplicity,int reverseMaxMultiplicity)
	{
		if(this.isRoot)
			return;
		if(!this.temporaryLinks.contains(name))
		{
			this.temporaryLinksPrepMap.put(name,new UniqueTypeLink(name,count,forwardMinMultiplicity,forwardMaxMultiplicity,reverseMinMultiplicity,reverseMaxMultiplicity));
		}
	}

	/**
	 * Returns the set of all the node's direct and indirect children.
	 * The node itself is not included, unless it is a child of itself
	 * (i.e., the tree is actually a cyclic graph, with the node being part of a cycle).
	 */
	Set<TreeNode> getAllChildren()
	{
		Set<TreeNode> allChildren = new HashSet<TreeNode>();
		Queue<TreeNode> workingQueue = new LinkedList<TreeNode>(this.childs);
		TreeNode child;

		while((child = workingQueue.poll()) != null)
		{
			if (allChildren.contains(child))
			{
				continue;
			}
			workingQueue.addAll(child.childs);
			allChildren.add(child);
		}

		return allChildren;
	}

	void calculateSubClassOfIntanceOfCount()
	{
		if(this.subClassOffInstanceCount == -1)
		{
			int totalCount = 0;
			Set<TreeNode> allChildren = this.getAllChildren();
			allChildren.add(this); // always count our own instances

			for(TreeNode child : allChildren)
			{
				totalCount += child.classInstanceCount;
			}

			this.subClassOffInstanceCount = totalCount;
		}
	}

	public void prepTemporaryLinks()
	{
		this.temporaryLinks.addAll(this.temporaryLinksPrepMap.values());
	}

	public UniqueTypeLink[] getTemporaryLinks()
	{
		return (UniqueTypeLink[])this.temporaryLinks.toArray(new UniqueTypeLink[0]);
	}

	void clean()
	{
		this.temporaryLinksPrepMap.clear();
		temporaryLinks.clear();
		temporaryLinksToRemove.clear();
		simplifyStep2Done = false;
		simplifyStep3Done = false;
		markParent = 0;
	}
	//Combine from upper level to lower level
	void simplifyStep2(HashSet<TreeNode> visited) throws Exception
	{
		if(simplifyStep2Done)
			return;
		simplifyStep2Done = true;
		if(visited.contains(this))
			throw new Exception("cycle in rdfs:subClassOf hiearchy found");
		visited.add(this);
		for(TreeNode child : this.childs)
		{
			child.simplifyStep2(visited);
			if(this.isRoot)
				continue;
			this.temporaryLinks.addAll(child.temporaryLinks);
		}
		boolean changed = true;
	outer:while(changed)
		{
			changed = false;
			for(UniqueTypeLink link1 : temporaryLinks)
			{
				for(UniqueTypeLink link2 : temporaryLinks)
				{
					if(link1 == link2)
						continue;
					String common = tree.findSharedType(link1.typeName,link2.typeName);
					if(common != null)
					{
						//destTypes.remove(dest1);
						temporaryLinks.remove(link2);
						link1.combineWith(link2,common);
						//destTypes.add(dest1);
						changed = true;
						continue outer;
					}
				}
			}
		}
		visited.remove(this);
	}
	//Mark 'none splitting' elements
	LinkedList<TreeNode> simplifyStep3_1()
	{
		if(this.simplifyStep3Done)
		{
			return new LinkedList<TreeNode>();
		}
		for(UniqueTypeLink dest : temporaryLinks)
		{
			int count = 0;
			for(TreeNode child : this.childs)
			{
				for(UniqueTypeLink destChild : child.temporaryLinks)
				{
					if(this.tree.isChildOf(dest.typeName,destChild.typeName))
						count++;
				}
			}
			if(count == 1) //count != 0 || count < 2
			{
				temporaryLinksToRemove.add(dest);
			}
		}
		this.simplifyStep3Done = true;
		return this.childs;
	}
	//Remove previously marked 'none splitting' elements
	void simplifyStep3_2()
	{
		this.temporaryLinks.removeAll(temporaryLinksToRemove);
	}
	//Remove element that are already referenced by parent node
	void simplifyStep4(HashSet<UniqueTypeLink> parentsContents)
	{
		LinkedList<UniqueTypeLink> toRemove = new LinkedList<UniqueTypeLink>();
		for(UniqueTypeLink dest : temporaryLinks)
		{
			for(UniqueTypeLink parentContent : parentsContents)
			{
				if(tree.isChildOf(parentContent.typeName,dest.typeName))
				{
					toRemove.add(dest);
					break;
				}
			}
		}
		this.temporaryLinks.removeAll(toRemove);
		HashSet<UniqueTypeLink> copy = (HashSet<UniqueTypeLink>)parentsContents.clone();
		copy.addAll(this.temporaryLinks);
		for(TreeNode child : this.childs)
		{
			child.simplifyStep4(copy);
		}
	}


	void markParentList1(int count)
	{
		this.markParent = count++;
		for(TreeNode parent : this.parents)
		{
			parent.markParentList1(count);
		}
	}
	//Search for the hihgest possible common ancestor
	TreeNode findCommon()
	{
		int max = 5; // TODO make configurable?
		TreeNode best = null;
		LinkedList<TreeNode> temp = new LinkedList<TreeNode>();
		temp.addAll(this.parents);
		temp.add(this);
		for(TreeNode parent : temp)
		{
			//exlude the root item we do not want to simplify down to root item
			if(parent.isRoot)
				continue;
			int checkMax = Integer.MAX_VALUE;
			TreeNode candidate = null;
			if(parent.markParent != 0)
			{
				checkMax = parent.markParent;
				candidate = parent;
			}
			else if(parent != this)
			{
				candidate = parent.findCommon();
				if(candidate != null)
					checkMax = candidate.markParent;
			}
			if(candidate != null && checkMax < max)
			{
				best = candidate;
				max = checkMax;
			}
		}
		return best;
	}

	boolean hasParent(TreeNode parent)
	{
		if(this == parent)
			return true;
		for(TreeNode checkParent : this.parents)
		{
			if(checkParent.hasParent(parent))
				return true;
		}
		return false;
	}

	public String toString()
	{
		return this.name;// + " | " + this.childs.toString();
	}

	public int hashCode()
	{
		return this.name.hashCode();
	}

	public boolean equals(Object other)
	{
		return this.name.equals(((TreeNode)other).name);
	}
}
