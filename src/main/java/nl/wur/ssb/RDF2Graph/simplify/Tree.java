package nl.wur.ssb.RDF2Graph.simplify;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;


public class Tree
{
	private HashMap<String,TreeNode> nodes = new HashMap<String,TreeNode>();
	private LinkedList<TreeNode> allNodes = new LinkedList<TreeNode>();
	private TreeNode root;

	public Tree()
	{

	}

	public void prepTemporaryLinks()
	{
		for(TreeNode node : nodes.values())
		{
			node.prepTemporaryLinks();
		}
	}

	public void simplifyStep2() throws Exception
	{
		this.root.simplifyStep2();
	}

	public void simplifyStep3()
	{
		LinkedList<TreeNode> todo = new LinkedList<TreeNode>();
		LinkedList<TreeNode> all = new LinkedList<TreeNode>();
		LinkedList<TreeNode> tmp;

		tmp = this.root.simplifyStep3_1();
		todo.addAll(tmp);
		all.addAll(tmp);

		while(!todo.isEmpty())
		{
			tmp = todo.removeFirst().simplifyStep3_1();
			todo.addAll(tmp);
			all.addAll(tmp);
		}

		for(TreeNode node : all)
		{
			node.simplifyStep3_2();
		}
	}

	public void simplifyStep4()
	{
		Collection<TreeNode> allNodes = this.root.getAllChildren();
		allNodes.add(this.root);
		for(TreeNode node : allNodes)
		{
			node.simplifyStep4_1();
		}
		for(TreeNode node : allNodes)
		{
			node.simplifyStep4_2();
		}
	}

	public TreeNode getNode(String node)
	{
		return this.nodes.get(node);
	}

	public TreeNode createMissingNode(String node,Tree tree)
	{
		TreeNode toRet = this.getCreateNode(node,-2);
		toRet.setParent(tree.root);
		return toRet;
	}

	private TreeNode getCreateNode(String node,int count)
	{
		if(nodes.containsKey(node))
			return nodes.get(node);
		TreeNode toRet = new TreeNode(node,this,count);
		nodes.put(node,toRet);
		allNodes.add(toRet);
		return toRet;
	}

	public void buildLink(String parent,int parentCount,String child,int childCount)
	{
		TreeNode parentNode = getCreateNode(parent,parentCount);
		TreeNode childNode = getCreateNode(child,childCount);
		childNode.setParent(parentNode);
	}

	public void finish()
	{
		root = new TreeNode(this);
		for(TreeNode node : nodes.values())
		{
			node.setRootIfNoParents(root);
		}
		this.allNodes.add(this.root);
		String[] rootClasses = new String[] {
			"http://www.w3.org/2002/07/owl#Thing",
			"http://www.wikidata.org/entity/Q35120",
			"http://www.wikidata.org/entity/Q58778",
			"http://www.wikidata.org/entity/Q151885",
			"http://www.wikidata.org/entity/Q223557",
			"http://www.wikidata.org/entity/Q488383",
			"http://www.wikidata.org/entity/Q618123",
			"http://www.wikidata.org/entity/Q830077",
			"http://www.wikidata.org/entity/Q4406616",
			"http://www.wikidata.org/entity/Q7184903",
			"http://www.wikidata.org/entity/Q6671777",
			"http://www.wikidata.org/entity/Q17553950",
		};
		for (String rootClass : rootClasses) {
			TreeNode classNode = this.nodes.get(rootClass);
			if(classNode != null) //TODO not for rdfs schema properties
				classNode.behaveAsRoot();
		}
	}

	public void calculateSubClassOfIntanceOfCount()
	{
		root.calculateSubClassOfIntanceOfCount();
		for(TreeNode child : root.getAllChildren())
		{
			child.calculateSubClassOfIntanceOfCount();
		}
	}

	public String findSharedType(String type1,String type2)
	{
		if(type1.equals(type2))
			return type1;
		TreeNode treeNode1 = this.getNode(type1);
		TreeNode treeNode2 = this.getNode(type2);
		if(treeNode1 == null || treeNode2 == null)
			return null;
		//reset the state
		for(TreeNode node : this.allNodes)
		{
			node.resetMarkParent();
		}
		treeNode1.markParentList1(1);
		TreeNode toRet = treeNode2.findCommon();
		if(toRet != null)
			return toRet.name;
		return null;
	}

	//Check if child is child of parent
	boolean isChildOf(String parent,String child)
	{
		if(parent.equals(child))
			return true;
		TreeNode treeNodeParent = this.getNode(parent);
		TreeNode treeNodeChild = this.getNode(child);
		if(treeNodeParent == null || treeNodeChild == null)
			return false;
		return treeNodeChild.hasParent(treeNodeParent);
	}

	public void clean()
	{
		for(TreeNode node : this.allNodes)
		{
			node.clean();
		}
		this.root.clean();
	}

	public LinkedList<TreeNode> getAllNodes()
	{
		return this.allNodes;
	}
}
